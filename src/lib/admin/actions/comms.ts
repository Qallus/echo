"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { parseSchema, plainToSchema, schemaToHtml, schemaToText, type EmailSchema } from "@/lib/comms/blocks";
import { contactRecipients, sendToRecipients, type Recipient } from "@/lib/comms/send";
import { email as cleanEmail, ref, refresh, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// Communications: email templates, sending, and the inbox (comms.manage,
// audited; never the message bodies).

const done = <T extends Result>(r: T): T => { revalidatePath("/admin/communications"); refresh(); return r; };

export async function saveTemplate(id: string | null, input: { name: string; subject: string; preheader?: string; category?: string; schema: EmailSchema }): Promise<Result> {
  await requireStaff("comms.manage");
  const name = text(input.name, 120);
  if (!name) return { error: "Give the template a name." };
  const schema = parseSchema(input.schema);
  if (!schema) return { error: "The template is empty." };
  const row = {
    name, subject: text(input.subject, 300) ?? "", preheader: text(input.preheader, 300), category: text(input.category, 40) ?? "general",
    schema, html: schemaToHtml(schema, { preheader: input.preheader, origin: siteUrl("") }), body_text: schemaToText(schema),
  };
  const supabase = await createClient();
  const { data, error } = id && isUuid(id)
    ? await supabase.from("email_templates").update(row).eq("id", id).select("id").single()
    : await supabase.from("email_templates").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, id ? "comms.template.update" : "comms.template.create", { type: "email_template", id: data.id }, { name });
  return done({ ok: "Template saved.", id: data.id });
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

// Send a template, or a plain message, to CRM contacts and/or typed addresses.
// Optionally tied to a deal (its fields merge and the email logs on it).
export async function sendEmails(input: {
  templateId?: string | null; subject?: string; body?: string; contactIds?: string[]; emails?: string; dealId?: string | null;
}): Promise<Result & { sent?: number; skipped?: number; failed?: number }> {
  await requireStaff("comms.manage");
  const supabase = await createClient();
  let schema: EmailSchema | null = null, subject = text(input.subject, 300) ?? "", preheader: string | null = null;
  const templateId = ref(input.templateId);
  if (templateId) {
    const { data: t } = await supabase.from("email_templates").select("subject, preheader, schema").eq("id", templateId).maybeSingle();
    if (!t) return { error: "Template not found." };
    schema = parseSchema(t.schema);
    subject = subject || t.subject;
    preheader = t.preheader;
  } else {
    const body = text(input.body, 50000);
    if (!body) return { error: "Write a message or pick a template." };
    schema = plainToSchema(body);
  }
  if (!schema) return { error: "That template can't be sent." };
  if (!subject) return { error: "Add a subject." };

  const dealId = ref(input.dealId);
  const { data: deal } = dealId ? await supabase.from("crm_deals").select("id, title, stage, value_cents, currency, contact_id").eq("id", dealId).maybeSingle() : { data: null };
  const contactIds = uuids(input.contactIds).slice(0, 500);
  const recipients: Recipient[] = await contactRecipients(supabase, contactIds, deal);
  const typed = (input.emails ?? "").split(/[,;\s]+/).map((e) => cleanEmail(e)).filter((e): e is string => typeof e === "string");
  const known = new Set(recipients.map((r) => r.email.toLowerCase()));
  for (const e of typed) if (!known.has(e)) recipients.push({ email: e, deal_id: deal?.id ?? null, values: { email: e, site_url: siteUrl("/") } });
  if (!recipients.length) return { error: "No one to send to. Recipients need an email address." };
  if (recipients.length > 500) return { error: "Send to 500 people or fewer at a time." };

  const res = await sendToRecipients(supabase, { subject, schema, preheader, templateId }, recipients);
  await adminAudit(supabase, "comms.email.send", { type: "email_template", id: templateId ?? "message" }, { sent: res.sent, skipped: res.skipped, failed: res.failed, deal_id: dealId });
  const parts = [`${res.sent} sent`, res.skipped && `${res.skipped} skipped (unsubscribed)`, res.failed && `${res.failed} failed`].filter(Boolean).join(", ");
  return done({ ...(res.sent ? { ok: `${parts}.` } : { error: `${parts}.${res.errors[0] ? ` ${res.errors[0]}` : ""}` }), sent: res.sent, skipped: res.skipped, failed: res.failed });
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
  const res = await sendToRecipients(supabase, { subject, schema: plainToSchema(text(body, 50000) ?? "", false) }, [{
    email: m.from_email, contact_id: m.contact_id, values: { first_name: m.from_name?.split(" ")[0], email: m.from_email },
  }]);
  if (!res.sent) return { error: res.errors[0] ?? "Couldn't send the reply." };
  await supabase.from("inbox_messages").update({ status: "read" }).eq("id", id);
  await adminAudit(supabase, "comms.inbox.reply", { type: "inbox_message", id });
  return done({ ok: "Reply sent." });
}

// For the compose dialog on CRM pages (which don't load templates themselves).
export async function templateOptions(): Promise<{ id: string; name: string; subject: string; category: string }[]> {
  await requireStaff("comms.view");
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("id, name, subject, category").order("name");
  return data ?? [];
}
