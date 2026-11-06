"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { queueAutomations } from "@/lib/comms/automations";
import { requireStaff } from "@/lib/admin/guard";
import { plainToSchema, renderTemplate } from "@/lib/comms/blocks";
import { deliver, previewSend, saveAudienceRow, saveTemplateRow, sendTest, type Content, type Preview, type SendOutcome, type Target, type TemplateInput } from "@/lib/comms/email";
import { sendToRecipients } from "@/lib/comms/send";
import { email as cleanEmail, ref, refresh, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid, requireUser } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// Communications: email templates, sending, and the inbox (comms.manage,
// audited; never the message bodies). The email rules (tests before bulk
// sends, caps, unsubscribes) live in lib/comms/email.ts.

export type TemplateOption = { id: string; name: string; subject: string; category: string; status: string };
const sender = async () => { const u = await requireUser(); return { id: u.id, email: u.email ?? null }; };
const done = <T extends Result>(r: T): T => { revalidatePath("/admin/communications"); refresh(); return r; };

export async function saveTemplate(id: string | null, input: TemplateInput): Promise<Result & { revision?: number }> {
  await requireStaff("comms.manage");
  const res = await saveTemplateRow(await createClient(), id, input, "admin");
  return done(res);
}

// Counts, a sample and anything blocking the send, before anyone presses Send.
export async function previewEmail(content: Content, target: Target): Promise<Preview | { error: string }> {
  await requireStaff("comms.manage");
  return previewSend(await createClient(), content, target, await sender());
}

export async function sendTestEmail(content: Content, target: Target | null): Promise<Result> {
  await requireStaff("comms.manage");
  return done(await sendTest(await createClient(), content, target, await sender()));
}

export async function saveAudience(id: string | null, input: { name: string; description?: string; definition: unknown }): Promise<Result> {
  await requireStaff("comms.manage");
  return done(await saveAudienceRow(await createClient(), id, input));
}

export async function deleteAudience(id: string): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_audiences").delete().eq("id", id).select("name").maybeSingle();
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.audience.delete", { type: "email_audience", id }, { name: data?.name });
  return done({ ok: "Audience deleted." });
}

export async function deleteTemplate(id: string): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_templates").delete().eq("id", id).select("name").maybeSingle();
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.template.delete", { type: "email_template", id }, { name: data?.name });
  return done({ ok: "Template deleted." });
}

// Send a template, a quick message or HTML to CRM contacts, typed addresses
// and/or an audience. Optionally tied to a deal (its fields merge and the
// email logs on it). `maxTotal` is the count the sender confirmed.
export async function sendEmails(input: Content & Target & { maxTotal?: number }): Promise<SendOutcome> {
  await requireStaff("comms.manage");
  const res = await deliver(await createClient(), input, input, { via: "admin", me: await sender(), maxTotal: input.maxTotal });
  return done(res as Result & SendOutcome);
}

export async function resubscribe(email: string): Promise<Result> {
  await requireStaff("comms.manage");
  const e = cleanEmail(email);
  if (!e) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("email_unsubscribes").delete().eq("email", e);
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.resubscribe", { type: "email", id: e });
  return done({ ok: `${e} can receive emails again.` });
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------
export async function setInboxStatus(ids: string[], status: "new" | "read" | "archived"): Promise<Result> {
  await requireStaff("comms.manage");
  const targets = uuids(ids);
  if (!targets.length || !["new", "read", "archived"].includes(status)) return { error: "Nothing to update." };
  const supabase = await createClient();
  const { error } = await supabase.from("inbox_messages").update({ status }).in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.inbox.status", { type: "inbox_message", id: targets[0] }, { count: targets.length, status });
  return done({ ok: targets.length > 1 ? `${targets.length} updated.` : "Updated." });
}

export async function deleteInbox(ids: string[]): Promise<Result> {
  await requireStaff("comms.manage");
  const targets = uuids(ids);
  if (!targets.length) return { error: "Nothing to delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("inbox_messages").delete().in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.inbox.delete", { type: "inbox_message", id: targets[0] }, { count: targets.length });
  return done({ ok: "Deleted." });
}

// Saves the sender as a contact or lead (or links the existing one by email)
// and, for "pipeline", opens a deal. The message lands on their timeline.
export async function convertInbox(id: string, as: "contact" | "lead" | "pipeline"): Promise<Result> {
  await requireStaff("comms.manage");
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("inbox_messages").select("*").eq("id", id).maybeSingle();
  if (!m) return { error: "Not found." };
  let contactId: string | null = m.contact_id;
  if (!contactId && m.from_email) {
    const { data: existing } = await supabase.from("crm_contacts").select("id").eq("email", m.from_email.toLowerCase()).limit(1).maybeSingle();
    contactId = existing?.id ?? null;
  }
  if (!contactId) {
    const [first, ...rest] = (m.from_name || m.from_email?.split("@")[0] || "Unknown").trim().split(/\s+/);
    let companyId: string | null = null;
    if (m.company) {
      const { data: c } = await supabase.from("crm_companies").select("id").eq("name", m.company).limit(1).maybeSingle();
      companyId = c?.id ?? (await supabase.from("crm_companies").insert({ name: m.company }).select("id").single()).data?.id ?? null;
    }
    const { data: created, error } = await supabase.from("crm_contacts").insert({
      first_name: first.slice(0, 100), last_name: rest.join(" ").slice(0, 100) || null, email: m.from_email, phone: m.phone, company_id: companyId,
      source: m.channel === "form" ? "Website" : "Email", interest: m.topic, role: as === "contact" ? "contact" : "lead",
      lead_status: as === "contact" ? null : "new",
    }).select("id").single();
    if (error) return { error: error.message };
    contactId = created.id;
    if (as !== "contact") await queueAutomations(supabase, "lead_created", [{ contactId: created.id }]);
  }
  await supabase.from("inbox_messages").update({ contact_id: contactId, status: "read" }).eq("id", id);
  await supabase.from("crm_activities").insert({
    kind: "email", direction: "inbound", subject: m.subject, body: m.body.slice(0, 100000), from_addr: m.from_email, to_addr: m.to_email,
    contact_id: contactId, occurred_at: m.created_at,
  });
  let dealId: string | null = null;
  if (as === "pipeline") {
    const { addToPipeline } = await import("./crm-pipeline");
    const res = await addToPipeline([contactId!]);
    if (res.error) return { error: res.error };
    dealId = res.dealIds?.[0] ?? null;
  }
  await adminAudit(supabase, "comms.inbox.convert", { type: "inbox_message", id }, { as, contact_id: contactId, deal_id: dealId });
  return done({ ok: as === "pipeline" ? (dealId ? "Added to the pipeline." : "Linked; they already have an open deal.") : "Saved to the CRM.", id: dealId ?? contactId ?? undefined });
}

export async function replyInbox(id: string, body: string): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("inbox_messages").select("from_email, from_name, subject, contact_id").eq("id", id).maybeSingle();
  if (!m?.from_email) return { error: "This message has no reply address." };
  const subject = m.subject?.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject ?? "your message"}`;
  const res = await sendToRecipients(supabase, { subject, ...renderTemplate({ mode: "blocks", schema: plainToSchema(text(body, 50000) ?? "", false), html: "" }, siteUrl("")) }, [{
    email: m.from_email, contact_id: m.contact_id, values: { first_name: m.from_name?.split(" ")[0], email: m.from_email },
  }]);
  if (!res.sent) return { error: res.errors[0] ?? "Couldn't send the reply." };
  await supabase.from("inbox_messages").update({ status: "read" }).eq("id", id);
  await adminAudit(supabase, "comms.inbox.reply", { type: "inbox_message", id });
  return done({ ok: "Reply sent." });
}

// For the template picker on CRM pages (which don't load templates themselves).
export async function templateOptions(): Promise<TemplateOption[]> {
  await requireStaff("comms.view");
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("id, name, subject, category, status").neq("status", "archived").order("name");
  return (data ?? []) as TemplateOption[];
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------
const TRIGGER_IDS = ["lead_created", "added_to_pipeline", "stage_changed", "closed_won", "closed_lost", "next_step_overdue", "deal_stalled"];
const STAGE_IDS = ["new_working", "contacted", "qualified", "opportunity", "proposal", "negotiation", "closed_won", "closed_lost", "nurture"];

export async function saveAutomation(id: string | null, input: {
  name: string; trigger: string; stage?: string | null; stalled_days?: number; template_id: string; recipient: string; delay_minutes?: number; enabled: boolean;
}): Promise<Result> {
  await requireStaff("comms.manage");
  const name = text(input.name, 120);
  if (!name) return { error: "Name the automation." };
  if (!TRIGGER_IDS.includes(input.trigger)) return { error: "Pick a trigger." };
  const templateId = ref(input.template_id);
  if (!templateId) return { error: "Pick a template." };
  const row = {
    name, trigger: input.trigger, stage: input.trigger === "stage_changed" && STAGE_IDS.includes(input.stage ?? "") ? input.stage : null,
    stalled_days: Math.max(1, Math.min(365, Math.round(Number(input.stalled_days) || 14))), template_id: templateId,
    recipient: input.recipient === "owner" ? "owner" : "contact", delay_minutes: Math.max(0, Math.min(525600, Math.round(Number(input.delay_minutes) || 0))),
    enabled: Boolean(input.enabled),
  };
  const supabase = await createClient();
  const { data, error } = id && isUuid(id)
    ? await supabase.from("email_automations").update(row).eq("id", id).select("id").single()
    : await supabase.from("email_automations").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, id ? "comms.automation.update" : "comms.automation.create", { type: "email_automation", id: data.id }, { name, trigger: row.trigger, enabled: row.enabled });
  return done({ ok: "Automation saved.", id: data.id });
}

export async function setAutomationEnabled(id: string, enabled: boolean): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("email_automations").update({ enabled }).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, enabled ? "comms.automation.on" : "comms.automation.off", { type: "email_automation", id });
  return done({ ok: enabled ? "On." : "Off." });
}

export async function deleteAutomation(id: string): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("email_automations").delete().eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.automation.delete", { type: "email_automation", id });
  return done({ ok: "Deleted." });
}
