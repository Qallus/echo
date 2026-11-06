import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/lib/billing/catalog";
import { STAGES, type DealStage } from "@/lib/crm/deals";
import { sendEmailBatch, siteUrl } from "@/lib/notify/senders";
import { secret } from "@/lib/secrets";
import { loadOrganization, orgMergeValues } from "@/lib/settings/organization";
import type { Audience } from "./audience";
import { applyMerge, parseSchema, renderTemplate } from "./blocks";
import { unsubscribeUrl } from "./unsubscribe";

// Sends one email per recipient as the signed-in staff member (RLS applies):
// merge fields per person, unsubscribed addresses skipped (with the reason
// logged), up to 100 emails per Resend request, every attempt logged to
// email_sends and, for CRM contacts, the activity timeline.

export type Recipient = {
  email: string; name?: string | null; contact_id?: string | null; company_id?: string | null; deal_id?: string | null;
  values: Record<string, string | null | undefined>;
};
// Rendered content, merge fields still in place.
export type Message = { subject: string; html: string; text: string; templateId?: string | null; campaignId?: string | null; test?: boolean };

const BATCH = 100;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Every unsubscribed address (a small list; read once per send).
export async function unsubscribedSet(supabase: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await supabase.from("email_unsubscribes").select("email").range(from, from + 999);
    for (const u of data ?? []) out.add(u.email);
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function sendToRecipients(supabase: SupabaseClient, msg: Message, recipients: Recipient[]) {
  const seen = new Set<string>();
  const list = recipients.filter((r) => { const e = r.email.toLowerCase(); if (seen.has(e)) return false; seen.add(e); return true; });
  const blocked = msg.test ? new Set<string>() : await unsubscribedSet(supabase);
  const from = (await secret("EMAIL_FROM")) ?? process.env.RESEND_FROM_EMAIL ?? null;
  const org = orgMergeValues(await loadOrganization(supabase));
  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];
  const log = (r: Recipient, subject: string, status: string, extra: { provider_id?: string | null; error?: string | null } = {}) => ({
    template_id: msg.templateId ?? null, campaign_id: msg.campaignId ?? null, to_email: r.email.toLowerCase(), subject, status,
    provider_id: extra.provider_id ?? null, error: extra.error?.slice(0, 1000) ?? null, contact_id: r.contact_id ?? null, deal_id: r.deal_id ?? null,
  });

  const skippedRows = list.filter((r) => blocked.has(r.email.toLowerCase()));
  if (skippedRows.length) {
    skipped = skippedRows.length;
    for (let i = 0; i < skippedRows.length; i += 500) {
      await supabase.from("email_sends").insert(skippedRows.slice(i, i + 500).map((r) => log(r, applyMerge(msg.subject, { ...org, ...r.values }).slice(0, 300), "skipped", { error: "Unsubscribed" })));
    }
  }
  const toSend = list.filter((r) => !blocked.has(r.email.toLowerCase()));

  for (let i = 0; i < toSend.length; i += BATCH) {
    if (i) await pause(600); // Resend allows about 2 requests a second
    const chunk = toSend.slice(i, i + BATCH).map((r) => {
      const to = r.email.toLowerCase();
      const unsub = unsubscribeUrl(to);
      const values = { ...org, ...r.values, unsubscribe_url: unsub };
      const subject = (msg.test ? "[Test] " : "") + (applyMerge(msg.subject, values).slice(0, 290) || "(no subject)");
      return { r, to, subject, values, unsub };
    });
    const results = await sendEmailBatch(chunk.map((c) => ({
      to: c.to, subject: c.subject, html: applyMerge(msg.html, c.values, true), text: applyMerge(msg.text, c.values),
      headers: { "List-Unsubscribe": `<${c.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    })), msg.campaignId ? `batch-campaign/${msg.campaignId}/${i}` : undefined);

    const rows = chunk.map((c, k) => log(c.r, c.subject, results[k].ok ? (msg.test ? "test" : "sent") : "failed", { provider_id: results[k].id, error: results[k].error }));
    await supabase.from("email_sends").insert(rows);
    const activities = [];
    for (const [k, c] of chunk.entries()) {
      const res = results[k];
      if (!res.ok) { failed++; if (res.error && !errors.includes(res.error)) errors.push(res.error); continue; }
      sent++;
      if (!msg.test && (c.r.contact_id || c.r.company_id || c.r.deal_id)) {
        activities.push({
          kind: "email", direction: "outbound", subject: c.subject, body: applyMerge(msg.text, c.values).slice(0, 100000), status: "sent",
          from_addr: from, to_addr: c.to, contact_id: c.r.contact_id ?? null, company_id: c.r.company_id ?? null, deal_id: c.r.deal_id ?? null,
        });
      }
    }
    if (activities.length) await supabase.from("crm_activities").insert(activities);
  }

  if (msg.templateId && sent && !msg.test) {
    const { data: t } = await supabase.from("email_templates").select("sends").eq("id", msg.templateId).maybeSingle();
    await supabase.from("email_templates").update({ sends: (t?.sends ?? 0) + sent, last_sent_at: new Date().toISOString() }).eq("id", msg.templateId);
  }
  return { sent, skipped, failed, errors, total: list.length };
}

type ContactRow = {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; title: string | null;
  company_id: string | null; owner_id: string | null; company: { name: string } | null;
};
type DealRow = { id: string; title: string; stage: DealStage; value_cents: number; currency: string; contact_id: string | null };
const CONTACT_COLS = "id, first_name, last_name, email, phone, title, company_id, owner_id, company:crm_companies(name)";

async function staffNames(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("crm_staff");
  return new Map(((data ?? []) as { user_id: string; name: string }[]).map((s) => [s.user_id, s.name]));
}

function contactRecipient(c: ContactRow, names: Map<string, string>, deal?: DealRow | null): Recipient {
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return {
    email: c.email!, name: full, contact_id: c.id, company_id: c.company_id, deal_id: deal?.id ?? null,
    values: {
      first_name: c.first_name, last_name: c.last_name, full_name: full, email: c.email, phone: c.phone, title: c.title, company: c.company?.name,
      owner: c.owner_id ? names.get(c.owner_id) : null, site_url: siteUrl("/"),
      deal: deal?.title, stage: deal ? STAGES[deal.stage].label : null, amount: deal ? money(deal.value_cents, deal.currency) : null,
    },
  };
}

// Merge values for CRM contacts (and their open deal, when one is given).
export async function contactRecipients(supabase: SupabaseClient, contactIds: string[], deal?: DealRow | null): Promise<Recipient[]> {
  if (!contactIds.length) return [];
  const [{ data }, names] = await Promise.all([supabase.from("crm_contacts").select(CONTACT_COLS).in("id", contactIds), staffNames(supabase)]);
  return ((data ?? []) as unknown as ContactRow[]).filter((c) => c.email).map((c) => contactRecipient(c, names, deal));
}

// Pages through a query 1,000 rows at a time, up to `cap` rows.
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, cap: number): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await page(from, Math.min(from + 999, cap - 1));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const AUDIENCE_CAP = 5000;

// Everyone an audience currently matches, with their merge values. Throws a
// readable message when the staff member can't read that source.
export async function audienceRecipients(supabase: SupabaseClient, a: Audience, cap = AUDIENCE_CAP + 1): Promise<Recipient[]> {
  if (a.source === "contacts") {
    const [rows, names] = await Promise.all([all<ContactRow>((from, to) => {
      let q = supabase.from("crm_contacts").select(CONTACT_COLS).not("email", "is", null).order("created_at").range(from, to);
      q = a.statuses?.length ? q.in("status", a.statuses) : q.neq("status", "archived");
      if (a.roles?.length) q = q.in("role", a.roles);
      if (a.leadStatuses?.length) q = q.in("lead_status", a.leadStatuses);
      if (a.ownerIds?.length) q = q.in("owner_id", a.ownerIds);
      if (a.tags?.length) q = a.tagMode === "all" ? q.contains("tags", a.tags) : q.overlaps("tags", a.tags);
      return q as unknown as PromiseLike<{ data: ContactRow[] | null; error: { message: string } | null }>;
    }, cap), staffNames(supabase)]);
    return rows.filter((c) => c.email).map((c) => contactRecipient(c, names));
  }
  if (a.source === "waitlist") {
    type W = { id: string; first_name: string; last_name: string; email: string; phone: string; company: string | null; contact_id: string | null };
    const rows = await all<W>((from, to) => {
      let q = supabase.from("app_waitlist").select("id, first_name, last_name, email, phone, company, contact_id").eq("consent_email", true).neq("status", "unsubscribed").order("created_at").range(from, to);
      if (a.products?.length) q = q.overlaps("products", a.products);
      if (a.topics?.length) q = q.overlaps("update_topics", a.topics);
      if (a.statuses?.length) q = q.in("status", a.statuses);
      return q;
    }, cap);
    return rows.map((w) => ({
      email: w.email, name: `${w.first_name} ${w.last_name}`, contact_id: w.contact_id,
      values: { first_name: w.first_name, last_name: w.last_name, full_name: `${w.first_name} ${w.last_name}`, email: w.email, phone: w.phone, company: w.company, site_url: siteUrl("/") },
    }));
  }
  type U = { email: string | null; full_name: string | null; confirmed: boolean; suspended: boolean; account_type: string; subscription_status: string | null };
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw new Error(/staff only|permission/i.test(error.message) ? "You need access to Users to email customers." : error.message);
  const plan = (s: string | null) => (s && ["active", "past_due"].includes(s) ? "paying" : s === "trialing" ? "trial" : "free");
  return ((data ?? []) as U[])
    .filter((u) => u.email && u.confirmed && !u.suspended)
    .filter((u) => !a.accountTypes?.length || a.accountTypes.includes(u.account_type))
    .filter((u) => !a.plans?.length || a.plans.includes(plan(u.subscription_status)))
    .slice(0, cap)
    .map((u) => {
      const [first, ...rest] = (u.full_name ?? "").trim().split(/\s+/);
      return { email: u.email!, name: u.full_name, values: { first_name: first || null, last_name: rest.join(" ") || null, full_name: u.full_name, email: u.email, site_url: siteUrl("/") } };
    });
}

// A template row -> what sendToRecipients needs (null if it has no content).
export function templateBody(t: { mode?: string | null; schema: unknown; html?: string | null; preheader?: string | null }): { html: string; text: string } | null {
  if (t.mode === "html") return t.html?.trim() ? renderTemplate({ mode: "html", schema: null, html: t.html, preheader: t.preheader }) : null;
  const schema = parseSchema(t.schema);
  return schema ? renderTemplate({ mode: "blocks", schema, html: "", preheader: t.preheader }, siteUrl("")) : null;
}
