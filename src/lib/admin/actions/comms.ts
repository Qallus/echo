"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { deliver, prepareSchedule, previewSend, saveAudienceRow, saveTemplateRow, sendTest, type Content, type Preview, type SendOutcome, type Target, type TemplateInput } from "@/lib/comms/email";
import { checkSendAt } from "@/lib/comms/schedule";
import { convertInboxMessage, replyInboxMessage } from "@/lib/comms/inbox";
import { email as cleanEmail, ref, refresh, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid, requireUser } from "@/lib/data";
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

// Schedule an email for later: checked like sending now (including the test
// rule), with the recipient list captured now. The 5-minute job sends it.
export async function scheduleEmail(input: Content & Target & { sendAt: string }): Promise<Result> {
  await requireStaff("comms.manage");
  const when = checkSendAt(input.sendAt);
  if ("error" in when) return when;
  const supabase = await createClient();
  const prep = await prepareSchedule(supabase, input, input, await sender());
  if ("error" in prep) return prep;
  const { data, error } = await supabase.from("scheduled_sends").insert({
    channel: "email", send_at: when.at.toISOString(), label: prep.label.slice(0, 300), subject: prep.subject.slice(0, 300),
    content: prep.content, recipients: prep.recipients, total: prep.recipients.length, via: "admin",
  }).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, "comms.email.schedule", { type: "scheduled_send", id: data.id }, { send_at: when.at.toISOString(), total: prep.recipients.length, audience: prep.label });
  return done({ ok: `Scheduled for ${prep.recipients.length.toLocaleString()} ${prep.recipients.length === 1 ? "person" : "people"}.` });
}

// Cancel an email or text send that hasn't started yet.
export async function cancelScheduled(id: string): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const me = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("scheduled_sends").update({ status: "canceled", canceled_by: me.id }).eq("id", id).eq("status", "scheduled").select("id, channel, total").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "It has already started or finished, so it can't be canceled." };
  await adminAudit(supabase, "comms.scheduled.cancel", { type: "scheduled_send", id }, { channel: data.channel, total: data.total });
  return done({ ok: "Canceled." });
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

export async function convertInbox(id: string, as: "contact" | "lead" | "pipeline"): Promise<Result> {
  await requireStaff("comms.manage");
  await requireStaff("crm.manage");
  return done(await convertInboxMessage(await createClient(), id, as));
}

export async function replyInbox(id: string, body: string): Promise<Result> {
  await requireStaff("comms.manage");
  return done(await replyInboxMessage(await createClient(), id, body));
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
