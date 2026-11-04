import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/lib/billing/catalog";
import { STAGES, type DealStage } from "@/lib/crm/deals";
import { sendEmail, siteUrl } from "@/lib/notify/senders";
import { secret } from "@/lib/secrets";
import { loadOrganization, orgMergeValues } from "@/lib/settings/organization";
import { applyMerge, schemaToHtml, schemaToText, type EmailSchema } from "./blocks";
import { unsubscribeUrl } from "./unsubscribe";

// Sends one email per recipient as the signed-in staff member (RLS applies):
// merge fields per person, unsubscribed addresses skipped, every attempt
// logged to email_sends and, for CRM contacts, the activity timeline.

export type Recipient = {
  email: string; contact_id?: string | null; company_id?: string | null; deal_id?: string | null;
  values: Record<string, string | null | undefined>;
};
export type Message = { subject: string; schema: EmailSchema; preheader?: string | null; templateId?: string | null };

export async function sendToRecipients(supabase: SupabaseClient, msg: Message, recipients: Recipient[]) {
  const emails = [...new Set(recipients.map((r) => r.email.toLowerCase()))];
  const { data: unsubs } = emails.length ? await supabase.from("email_unsubscribes").select("email").in("email", emails) : { data: [] };
  const blocked = new Set((unsubs ?? []).map((u) => u.email));
  const html = schemaToHtml(msg.schema, { preheader: msg.preheader ?? undefined, origin: siteUrl("") });
  const text = schemaToText(msg.schema);
  const from = (await secret("EMAIL_FROM")) ?? process.env.RESEND_FROM_EMAIL ?? null;
  const org = orgMergeValues(await loadOrganization(supabase));
  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];

  for (let r of recipients) {
    const to = r.email.toLowerCase();
    r = { ...r, values: { ...org, ...r.values } };
    const subject = applyMerge(msg.subject, r.values).slice(0, 300) || "(no subject)";
    if (blocked.has(to)) {
      skipped++;
      await supabase.from("email_sends").insert({ template_id: msg.templateId ?? null, to_email: to, subject, status: "skipped", error: "Unsubscribed", contact_id: r.contact_id ?? null, deal_id: r.deal_id ?? null });
      continue;
    }
    const unsub = unsubscribeUrl(to);
    const values = { ...r.values, unsubscribe_url: unsub };
    const res = await sendEmail(to, subject, applyMerge(html, values, true), applyMerge(text, values), {
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    await supabase.from("email_sends").insert({
      template_id: msg.templateId ?? null, to_email: to, subject, status: res.ok ? "sent" : "failed", provider_id: res.id ?? null,
      error: res.error?.slice(0, 1000) ?? null, contact_id: r.contact_id ?? null, deal_id: r.deal_id ?? null,
    });
    if (!res.ok) { failed++; if (res.error && !errors.includes(res.error)) errors.push(res.error); continue; }
    sent++;
    if (r.contact_id || r.company_id || r.deal_id) {
      await supabase.from("crm_activities").insert({
        kind: "email", direction: "outbound", subject, body: applyMerge(text, values).slice(0, 100000), status: "sent",
        from_addr: from, to_addr: to, contact_id: r.contact_id ?? null, company_id: r.company_id ?? null, deal_id: r.deal_id ?? null,
      });
    }
  }
  if (msg.templateId && sent) {
    const { data: t } = await supabase.from("email_templates").select("sends").eq("id", msg.templateId).maybeSingle();
    await supabase.from("email_templates").update({ sends: (t?.sends ?? 0) + sent, last_sent_at: new Date().toISOString() }).eq("id", msg.templateId);
  }
  return { sent, skipped, failed, errors };
}

type ContactRow = {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; title: string | null;
  company_id: string | null; owner_id: string | null; company: { name: string } | null;
};
type DealRow = { id: string; title: string; stage: DealStage; value_cents: number; currency: string; contact_id: string | null };

// Merge values for CRM contacts (and their open deal, when one is given).
export async function contactRecipients(supabase: SupabaseClient, contactIds: string[], deal?: DealRow | null): Promise<Recipient[]> {
  if (!contactIds.length) return [];
  const [{ data }, { data: staff }] = await Promise.all([
    supabase.from("crm_contacts").select("id, first_name, last_name, email, phone, title, company_id, owner_id, company:crm_companies(name)").in("id", contactIds),
    supabase.rpc("crm_staff"),
  ]);
  const names = new Map(((staff ?? []) as { user_id: string; name: string }[]).map((s) => [s.user_id, s.name]));
  return ((data ?? []) as unknown as ContactRow[]).filter((c) => c.email).map((c) => ({
    email: c.email!, contact_id: c.id, company_id: c.company_id, deal_id: deal?.id ?? null,
    values: {
      first_name: c.first_name, last_name: c.last_name, full_name: [c.first_name, c.last_name].filter(Boolean).join(" "), email: c.email,
      phone: c.phone, title: c.title, company: c.company?.name, owner: c.owner_id ? names.get(c.owner_id) : null, site_url: siteUrl("/"),
      deal: deal?.title, stage: deal ? STAGES[deal.stage].label : null, amount: deal ? money(deal.value_cents, deal.currency) : null,
    },
  }));
}
