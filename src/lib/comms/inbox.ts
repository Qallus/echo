import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import { queueAutomations } from "@/lib/comms/automations";
import { plainToSchema, renderTemplate } from "@/lib/comms/blocks";
import { sendToRecipients } from "@/lib/comms/send";
import { contactsToDeals } from "@/lib/crm/ops";
import { text, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { staffFilter } from "@/lib/schema-ready";

// Inbox actions shared by Admin -> Communications and the connector. The
// caller checks comms.manage (and crm.manage to convert); RLS checks again.

// Saves the sender as a contact or lead (or links the existing one by email)
// and, for "pipeline", opens a deal. The message lands on their timeline.
export async function convertInboxMessage(supabase: SupabaseClient, id: string, as: "contact" | "lead" | "pipeline"): Promise<Result> {
  if (!isUuid(id)) return { error: "Not found." };
  const { data: m } = await supabase.from("inbox_messages").select("*").eq("id", id).maybeSingle();
  if (!m) return { error: "Not found." };
  let contactId: string | null = m.contact_id;
  if (!contactId && m.from_email) {
    const { data: existing } = await (await staffFilter("crm_contacts", supabase))(supabase.from("crm_contacts").select("id").eq("email", m.from_email.toLowerCase()).limit(1)).maybeSingle();
    contactId = existing?.id ?? null;
  }
  if (!contactId) {
    const [first, ...rest] = (m.from_name || m.from_email?.split("@")[0] || "Unknown").trim().split(/\s+/);
    let companyId: string | null = null;
    if (m.company) {
      const { data: c } = await (await staffFilter("crm_companies", supabase))(supabase.from("crm_companies").select("id").eq("name", m.company).limit(1)).maybeSingle();
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
    const res = await contactsToDeals(supabase, [contactId!]);
    if (res.error) return { error: res.error };
    dealId = res.dealIds?.[0] ?? null;
  }
  await adminAudit(supabase, "comms.inbox.convert", { type: "inbox_message", id }, { as, contact_id: contactId, deal_id: dealId });
  return ({ ok: as === "pipeline" ? (dealId ? "Added to the pipeline." : "Linked; they already have an open deal.") : "Saved to the CRM.", id: dealId ?? contactId ?? undefined });
}

export async function replyInboxMessage(supabase: SupabaseClient, id: string, body: string): Promise<Result> {
  if (!isUuid(id)) return { error: "Not found." };
  const { data: m } = await supabase.from("inbox_messages").select("from_email, from_name, subject, contact_id").eq("id", id).maybeSingle();
  if (!m?.from_email) return { error: "This message has no reply address." };
  const subject = m.subject?.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject ?? "your message"}`;
  const res = await sendToRecipients(supabase, { subject, ...renderTemplate({ mode: "blocks", schema: plainToSchema(text(body, 50000) ?? "", false), html: "" }, siteUrl("")) }, [{
    email: m.from_email, contact_id: m.contact_id, values: { first_name: m.from_name?.split(" ")[0], email: m.from_email },
  }]);
  if (!res.sent) return { error: res.errors[0] ?? "Couldn't send the reply." };
  await supabase.from("inbox_messages").update({ status: "read" }).eq("id", id);
  await adminAudit(supabase, "comms.inbox.reply", { type: "inbox_message", id });
  return { ok: "Reply sent." };
}

