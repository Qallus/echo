import "server-only";
import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/lib/billing/catalog";
import { applyMerge } from "@/lib/comms/blocks";
import { contactRecipients, sendToRecipients, templateBody, type Recipient } from "@/lib/comms/send";
import { phoneNumber, twilioSms } from "@/lib/comms/twilio";
import { OPEN_STAGES, STAGES, type DealStage } from "@/lib/crm/deals";
import { siteUrl, toE164 } from "@/lib/notify/senders";
import { secret } from "@/lib/secrets";
import { isSafeWebhookUrl, matches, type Context, type Rule, type RuleAction } from "./rules";

// Runs automation rules (service role, from /api/cron/comms). Database
// triggers queue runs for CRM, booking and inbox events; queueTimedRules adds
// overdue and stalled deals; processRuleRuns checks each run's conditions
// against the record as it is now and carries out the actions.

type Run = { id: string; rule_id: string; deal_id: string | null; contact_id: string | null; booking_id: string | null; message_id: string | null; rule: Rule | null };
type Result = { type: RuleAction["type"]; ok: boolean; detail?: string };

// The record a run is about, flattened for conditions and merge fields.
type Loaded = {
  ctx: Context; values: Record<string, string | null | undefined>;
  deal: { id: string; title: string; stage: DealStage; value_cents: number; currency: string; owner_id: string | null; contact_id: string | null; company_id: string | null } | null;
  contact: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; owner_id: string | null; company_id: string | null } | null;
  email: string | null; phone: string | null; name: string | null;
};

export async function queueTimedRules(db: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rules } = await db.from("automation_rules").select("id, trigger, stalled_days, delay_minutes")
    .in("trigger", ["next_step_overdue", "deal_stalled"]).eq("enabled", true);
  const rows: Record<string, unknown>[] = [];
  for (const r of rules ?? []) {
    const runAt = new Date(Date.now() + r.delay_minutes * 60_000).toISOString();
    if (r.trigger === "next_step_overdue") {
      const { data } = await db.from("crm_deals").select("id, contact_id, next_step_due").in("stage", OPEN_STAGES).lt("next_step_due", today).limit(500);
      for (const d of data ?? []) rows.push({ rule_id: r.id, deal_id: d.id, contact_id: d.contact_id, run_key: `next_step_overdue:${d.id}:${d.next_step_due}`, run_at: runAt });
    } else {
      const cutoff = new Date(Date.now() - r.stalled_days * 86400_000).toISOString();
      const { data } = await db.from("crm_deals").select("id, contact_id, updated_at").in("stage", OPEN_STAGES).lt("updated_at", cutoff).limit(500);
      for (const d of data ?? []) {
        const { count } = await db.from("crm_activities").select("id", { count: "exact", head: true }).eq("deal_id", d.id).gt("occurred_at", cutoff);
        if (!count) rows.push({ rule_id: r.id, deal_id: d.id, contact_id: d.contact_id, run_key: `deal_stalled:${d.id}:${d.updated_at.slice(0, 10)}`, run_at: runAt });
      }
    }
  }
  if (rows.length) await db.from("automation_rule_runs").upsert(rows, { onConflict: "rule_id,run_key", ignoreDuplicates: true });
  return rows.length;
}

export async function processRuleRuns(db: SupabaseClient) {
  const { data } = await db.from("automation_rule_runs")
    .select("id, rule_id, deal_id, contact_id, booking_id, message_id, rule:automation_rules(*)")
    .eq("status", "queued").lte("run_at", new Date().toISOString()).order("run_at").limit(100);
  let done = 0;
  for (const run of (data ?? []) as unknown as Run[]) {
    const finish = (status: string, detail: string | null, results: Result[] = []) =>
      db.from("automation_rule_runs").update({ status, detail: detail?.slice(0, 1000) ?? null, results }).eq("id", run.id);
    const rule = run.rule;
    if (!rule?.enabled) { await finish("skipped", "The rule is off."); continue; }
    const rec = await load(db, run);
    if (!rec) { await finish("skipped", "The record no longer exists."); continue; }
    if (!matches(rec.ctx, rule.conditions ?? [], rule.match)) { await finish("skipped", "Conditions not met."); continue; }

    const results: Result[] = [];
    for (const action of rule.actions ?? []) {
      try {
        results.push({ type: action.type, ...(await perform(db, action, rec, rule, run)) });
      } catch (e) {
        results.push({ type: action.type, ok: false, detail: e instanceof Error ? e.message : "Failed." });
      }
    }
    const failed = results.filter((r) => !r.ok);
    await finish(failed.length ? "failed" : "done", failed[0]?.detail ?? null, results);
    await db.from("automation_rules").update({ runs: rule.runs + 1, last_run_at: new Date().toISOString() }).eq("id", rule.id);
    done++;
  }
  return done;
}

async function load(db: SupabaseClient, run: Run): Promise<Loaded | null> {
  const ctx: Context = {};
  const values: Record<string, string | null | undefined> = { site_url: siteUrl("/") };
  let deal: Loaded["deal"] = null, contact: Loaded["contact"] = null;
  let email: string | null = null, phone: string | null = null, name: string | null = null;

  if (run.deal_id) {
    const { data } = await db.from("crm_deals").select("id, title, stage, value_cents, currency, probability, source, opportunity_type, owner_id, contact_id, company_id").eq("id", run.deal_id).maybeSingle();
    if (!data) return null;
    deal = data;
    Object.assign(ctx, { "deal.title": data.title, "deal.stage": data.stage, "deal.value": data.value_cents / 100, "deal.probability": data.probability, "deal.source": data.source, "deal.opportunity_type": data.opportunity_type });
    Object.assign(values, { deal: data.title, stage: STAGES[data.stage as DealStage]?.label ?? data.stage, amount: money(data.value_cents, data.currency) });
  }
  const contactId = run.contact_id ?? deal?.contact_id ?? null;
  if (contactId) {
    const { data } = await db.from("crm_contacts").select("id, first_name, last_name, email, phone, source, role, lead_status, tags, state, owner_id, company_id").eq("id", contactId).maybeSingle();
    if (data) {
      contact = data;
      Object.assign(ctx, { "contact.source": data.source, "contact.role": data.role, "contact.lead_status": data.lead_status, "contact.tags": (data.tags ?? []).join(", "), "contact.email": data.email, "contact.phone": data.phone, "contact.state": data.state });
      email = data.email; phone = data.phone; name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    } else if (!deal) return null;
  }
  if (run.booking_id) {
    const { data } = await db.from("bookings").select("title, name, email, phone, company, location, source, starts_at, type:booking_types(name)").eq("id", run.booking_id).maybeSingle();
    if (!data) return null;
    const type = (data.type as unknown as { name: string } | null)?.name ?? null;
    Object.assign(ctx, { "booking.type": type, "booking.title": data.title, "booking.location": data.location, "booking.source": data.source, "booking.email": data.email, "booking.company": data.company });
    email ??= data.email; phone ??= data.phone; name ??= data.name;
    values.when = new Date(data.starts_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: await orgTimezone(db) });
    values.subject = data.title;
  }
  if (run.message_id) {
    const { data } = await db.from("inbox_messages").select("channel, topic, subject, from_email, from_name, phone, body").eq("id", run.message_id).maybeSingle();
    if (!data) return null;
    Object.assign(ctx, { "message.channel": data.channel, "message.topic": data.topic, "message.subject": data.subject, "message.from_email": data.from_email, "message.body": data.body });
    email ??= data.from_email; phone ??= data.phone; name ??= data.from_name;
    values.subject = data.subject;
  }
  Object.assign(values, { full_name: name, first_name: name?.split(" ")[0] ?? null, email, phone });
  return { ctx, values, deal, contact, email, phone, name };
}

async function orgTimezone(db: SupabaseClient) {
  const { data } = await db.from("platform_settings").select("value").eq("key", "organization").maybeSingle();
  return (data?.value as { timezone?: string } | null)?.timezone || "America/Phoenix";
}

async function userEmail(db: SupabaseClient, id: string | null | undefined) {
  if (!id) return null;
  return (await db.auth.admin.getUserById(id)).data.user?.email ?? null;
}

async function perform(db: SupabaseClient, a: RuleAction, rec: Loaded, rule: Rule, run: Run): Promise<Omit<Result, "type">> {
  const ownerId = rec.deal?.owner_id ?? rec.contact?.owner_id ?? null;
  switch (a.type) {
    case "send_email": {
      const { data: t } = await db.from("email_templates").select("id, subject, preheader, schema, html, mode, status").eq("id", a.templateId).maybeSingle();
      const body = t ? templateBody(t) : null;
      if (!t || !body) return { ok: false, detail: "The email template is missing." };
      if (t.status !== "active") return { ok: true, detail: "Skipped: the template is a draft or archived." };
      let recipients: Recipient[] = [];
      if (a.to === "contact" && rec.contact?.email) {
        recipients = await contactRecipients(db, [rec.contact.id], rec.deal);
        recipients = recipients.map((r) => ({ ...r, values: { ...rec.values, ...r.values } }));
      } else {
        const to = a.to === "owner" ? await userEmail(db, ownerId) : a.to === "custom" ? a.email ?? null : rec.email;
        if (to) recipients = [{ email: to, contact_id: a.to === "contact" ? rec.contact?.id ?? null : null, deal_id: rec.deal?.id ?? null, values: rec.values }];
      }
      if (!recipients.length) return { ok: false, detail: "No email address to send to." };
      const res = await sendToRecipients(db, { subject: t.subject, ...body, templateId: t.id }, recipients);
      return res.sent ? { ok: true, detail: `Sent to ${recipients[0].email}` } : { ok: Boolean(res.skipped), detail: res.errors[0] ?? "Unsubscribed." };
    }
    case "send_sms": {
      const to = toE164(a.to === "custom" ? a.phone ?? "" : rec.phone ?? "");
      if (!to) return { ok: false, detail: "No valid phone number to text." };
      const { data: optedOut } = await db.from("phone_opt_outs").select("number").eq("number", to).maybeSingle();
      if (optedOut) return { ok: true, detail: "Skipped: this number replied STOP." };
      const body = applyMerge(a.body, rec.values).slice(0, 1600);
      const res = await twilioSms(to, body);
      const contactId = a.to === "contact" ? rec.contact?.id ?? null : null;
      await db.from("phone_messages").insert({
        direction: "outbound", from_number: (await phoneNumber()) ?? "", to_number: to, body, status: res.ok ? res.status ?? "queued" : "failed",
        error: res.error?.slice(0, 500) ?? null, twilio_sid: res.sid ?? null, contact_id: contactId, deal_id: rec.deal?.id ?? null,
      });
      if (res.ok && (contactId || rec.deal)) {
        await db.from("crm_activities").insert({ kind: "sms", direction: "outbound", body, status: "sent", to_addr: to, contact_id: contactId, deal_id: rec.deal?.id ?? null });
      }
      return res.ok ? { ok: true, detail: `Texted ${to}` } : { ok: false, detail: res.error ?? "Couldn't send." };
    }
    case "create_task": {
      if (!rec.deal && !rec.contact) return { ok: false, detail: "Tasks need a deal or contact; this record has neither." };
      const due = new Date(Date.now() + a.dueInDays * 86400_000);
      const { error } = await db.from("crm_activities").insert({
        kind: "task", body: applyMerge(a.title, rec.values).slice(0, 2000) || "Follow up", due_at: due.toISOString(),
        deal_id: rec.deal?.id ?? null, contact_id: rec.contact?.id ?? null, created_by: rule.created_by ?? null,
      });
      return error ? { ok: false, detail: error.message } : { ok: true, detail: `Due ${due.toISOString().slice(0, 10)}` };
    }
    case "assign_owner": {
      const table = rec.deal ? "crm_deals" : rec.contact ? "crm_contacts" : null;
      if (!table) return { ok: false, detail: "Only deals and contacts have owners." };
      const { error } = await db.from(table).update({ owner_id: a.userId }).eq("id", (rec.deal ?? rec.contact)!.id);
      return error ? { ok: false, detail: error.message } : { ok: true };
    }
    case "notify_staff": {
      const userId = a.userId === "owner" ? ownerId : a.userId;
      if (!userId) return { ok: false, detail: "No owner to notify." };
      const url = rec.deal ? `/admin/pipeline/${rec.deal.id}` : rec.contact ? `/admin/contacts/${rec.contact.id}`
        : run.booking_id ? "/admin/bookings" : run.message_id ? "/admin/communications?tab=inbox" : "/admin/automation";
      const { error } = await db.from("notifications").insert({
        user_id: userId, type: "automation", title: applyMerge(a.title, rec.values).slice(0, 200), body: `Rule: ${rule.name}`.slice(0, 1000), url, data: { rule_id: rule.id },
      });
      return error ? { ok: false, detail: error.message } : { ok: true };
    }
    case "webhook": {
      if (!(await resolvesPublic(a.url))) return { ok: false, detail: "The webhook URL isn't a public https address." };
      const body = JSON.stringify({ rule: { id: rule.id, name: rule.name, trigger: rule.trigger }, record: rec.ctx, sent_at: new Date().toISOString() });
      const key = await secret("AUTOMATION_WEBHOOK_SECRET");
      const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Echo-Automation/1" };
      if (key) headers["x-echo-signature"] = `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
      const res = await fetch(a.url, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(10_000) });
      return res.ok ? { ok: true, detail: `HTTP ${res.status}` } : { ok: false, detail: `HTTP ${res.status}` };
    }
  }
}

// Re-checks the URL and every address its host resolves to, so a public name
// can't point the request at a private network.
async function resolvesPublic(url: string) {
  if (!isSafeWebhookUrl(url)) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => isSafeWebhookUrl(`https://${a.family === 6 ? `[${a.address}]` : a.address}/`));
  } catch {
    return false;
  }
}
