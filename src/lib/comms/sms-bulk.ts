import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uuids } from "@/lib/crm/validate";
import { loadOrganization } from "@/lib/settings/organization";
import { applyMerge } from "./blocks";
import { QUIET, SMS_CAP, SMS_KINDS, STOP_LINE, isSmsKind, smsSegments, type SmsKind } from "./sms-kinds";
import { e164, phoneNumber, twilioSms } from "./twilio";

// Scheduled texts: to chosen numbers or contacts, or to waitlist people who
// agreed to texts (filtered by their frequency and topic choices). Numbers
// that texted STOP are always skipped, at scheduling and again at send time.

export type SmsAudience = { kind: SmsKind; topic?: string | null; products?: string[] };
export type SmsInput = { body: string; sendAt?: string | null; to?: string[]; contactIds?: string[]; audience?: SmsAudience | null };
export type SmsRecipient = { phone: string; name: string | null; contact_id: string | null; values: Record<string, string | null> };
export type SmsPreview = {
  label: string; total: number; sendable: number; optedOut: number; sample: { name: string | null; phone: string }[];
  body: string; segments: number; problems: string[];
};
type Fail = { error: string };

const names = (first?: string | null, last?: string | null) => ({ first_name: first ?? null, last_name: last ?? null, full_name: [first, last].filter(Boolean).join(" ") || null });

// The message as it will be sent: bulk texts always say how to opt out.
export const finalBody = (body: string, bulk: boolean) => {
  const b = body.trim().slice(0, 1500);
  return bulk && !/\bstop\b/i.test(b) ? `${b}\n\n${STOP_LINE}` : b;
};

async function optOuts(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("phone_opt_outs").select("number").limit(50000);
  return new Set((data ?? []).map((r) => r.number));
}

async function resolve(supabase: SupabaseClient, input: SmsInput): Promise<{ recipients: SmsRecipient[]; label: string; bulk: boolean } | Fail> {
  const out: SmsRecipient[] = [];
  const audience = input.audience && isSmsKind(input.audience.kind) ? input.audience : null;
  if (input.audience && !audience) return { error: "Pick what kind of text this is." };
  if (audience) {
    let q = supabase.from("app_waitlist").select("first_name, last_name, phone, contact_id")
      .eq("consent_sms", true).neq("status", "unsubscribed").in("sms_frequency", [...SMS_KINDS[audience.kind].allows]).limit(SMS_CAP + 1);
    if (audience.topic) q = q.contains("update_topics", [audience.topic]);
    const products = (audience.products ?? []).filter((p) => p === "echo" || p === "redial");
    if (products.length) q = q.overlaps("products", products);
    const { data, error } = await q;
    if (error) return { error: error.message };
    for (const w of data ?? []) {
      const phone = e164(w.phone);
      if (phone) out.push({ phone, name: [w.first_name, w.last_name].filter(Boolean).join(" ") || null, contact_id: w.contact_id, values: names(w.first_name, w.last_name) });
    }
  }
  const fromAudience = out.length;
  const ids = uuids(input.contactIds).slice(0, 500);
  if (ids.length) {
    const { data } = await supabase.from("crm_contacts").select("id, first_name, last_name, phone").in("id", ids);
    for (const c of data ?? []) {
      const phone = e164(c.phone);
      if (phone) out.push({ phone, name: [c.first_name, c.last_name].filter(Boolean).join(" "), contact_id: c.id, values: names(c.first_name, c.last_name) });
    }
  }
  for (const raw of (input.to ?? []).slice(0, 500)) {
    const phone = e164(raw);
    if (phone) out.push({ phone, name: null, contact_id: null, values: names() });
  }
  const seen = new Set<string>();
  const recipients = out.filter((r) => (seen.has(r.phone) ? false : (seen.add(r.phone), true)));
  const kind = audience ? SMS_KINDS[audience.kind].label : "";
  const label = audience ? `Waitlist texts: ${kind}${audience.topic ? ` (${audience.topic})` : ""}${out.length > fromAudience ? " + people you added" : ""}`
    : recipients.length === 1 ? recipients[0].name ?? recipients[0].phone : `${recipients.length} people`;
  return { recipients, label, bulk: Boolean(audience) || recipients.length > 1 };
}

// Hour of a moment in the business's time zone.
const hourIn = (at: Date, timeZone: string) => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(at));

export async function previewTexts(supabase: SupabaseClient, input: SmsInput): Promise<SmsPreview | Fail> {
  const r = await resolve(supabase, input);
  if ("error" in r) return r;
  const blocked = await optOuts(supabase);
  const ok = r.recipients.filter((x) => !blocked.has(x.phone));
  const body = finalBody(input.body ?? "", r.bulk);
  const problems: string[] = [];
  if (!input.body?.trim()) problems.push("Write a message.");
  if (!r.recipients.length) problems.push("No one matches. People need a phone number (and, on the waitlist, to have agreed to texts).");
  if (r.recipients.length > SMS_CAP) problems.push(`That's more than ${SMS_CAP.toLocaleString()} people. Narrow it down.`);
  if (r.bulk && input.sendAt) {
    const org = await loadOrganization(supabase);
    const h = hourIn(new Date(input.sendAt), org.timezone);
    if (h < QUIET.from || h >= QUIET.to) problems.push(`Bulk texts can only go out between 8am and 9pm (${org.timezone.replace(/_/g, " ")}). Pick another time.`);
  }
  const first = ok[0];
  return {
    label: r.label, total: r.recipients.length, sendable: ok.length, optedOut: r.recipients.length - ok.length,
    sample: ok.slice(0, 5).map((x) => ({ name: x.name, phone: x.phone })),
    body: first ? applyMerge(body, first.values) : body, segments: smsSegments(body), problems,
  };
}

// Checks, then captures who it goes to (opt-outs are checked again at send time).
export async function prepareTexts(supabase: SupabaseClient, input: SmsInput): Promise<{ recipients: SmsRecipient[]; label: string; body: string; bulk: boolean } | Fail> {
  const p = await previewTexts(supabase, input);
  if ("error" in p) return p;
  if (p.problems.length) return { error: p.problems[0] };
  const r = await resolve(supabase, input);
  if ("error" in r) return r;
  const blocked = await optOuts(supabase);
  return { recipients: r.recipients.filter((x) => !blocked.has(x.phone)), label: r.label, body: finalBody(input.body, r.bulk), bulk: r.bulk };
}

// The job: sends the next part of a scheduled text send until `deadline`,
// from where the last run stopped (row.progress). Returns whether it's done.
export async function sendScheduledTexts(db: SupabaseClient, row: {
  id: string; content: unknown; recipients: unknown; progress: number; sent: number; skipped: number; failed: number; created_by: string | null;
}, deadline: number): Promise<{ done: boolean; progress: number; sent: number; skipped: number; failed: number; error?: string }> {
  const content = (row.content ?? {}) as { body?: string; kind?: string };
  const list = (Array.isArray(row.recipients) ? row.recipients : []) as SmsRecipient[];
  const state = { progress: row.progress, sent: row.sent, skipped: row.skipped, failed: row.failed };
  const from = await phoneNumber();
  if (!from) return { done: true, ...state, error: "Texting isn't set up (Admin → Settings → Integrations → Twilio)." };
  const blocked = await optOuts(db);
  const gap = isSmsKind(content.kind) ? SMS_KINDS[content.kind].gapDays : 0;

  // Other bulk text sends recently, for the per-person frequency check.
  let bulkIds: string[] = [];
  if (gap) {
    const since = new Date(Date.now() - gap * 864e5).toISOString();
    const { data } = await db.from("scheduled_sends").select("id").eq("channel", "sms").neq("id", row.id).not("content->>kind", "is", null).gte("send_at", since).limit(500);
    bulkIds = (data ?? []).map((x) => x.id);
  }

  while (state.progress < list.length && Date.now() < deadline) {
    const chunk = list.slice(state.progress, state.progress + 50);
    let recent = new Set<string>();
    if (gap && bulkIds.length) {
      const { data } = await db.from("phone_messages").select("to_number").in("scheduled_id", bulkIds).in("to_number", chunk.map((c) => c.phone))
        .gte("created_at", new Date(Date.now() - gap * 864e5).toISOString());
      recent = new Set((data ?? []).map((x) => x.to_number));
    }
    for (const r of chunk) {
      if (Date.now() >= deadline) break;
      state.progress++;
      if (blocked.has(r.phone) || recent.has(r.phone)) { state.skipped++; continue; }
      const body = applyMerge(content.body ?? "", r.values ?? {}).trim();
      if (!body) { state.skipped++; continue; }
      const res = await twilioSms(r.phone, body);
      await db.from("phone_messages").insert({
        direction: "outbound", from_number: from, to_number: r.phone, body: body.slice(0, 2000), status: res.ok ? res.status ?? "queued" : "failed",
        error: res.error?.slice(0, 500) ?? null, twilio_sid: res.sid ?? null, contact_id: r.contact_id, scheduled_id: row.id, sent_by: row.created_by,
      });
      if (res.ok) {
        state.sent++;
        if (r.contact_id) await db.from("crm_activities").insert({ kind: "sms", direction: "outbound", body: body.slice(0, 2000), status: "sent", to_addr: r.phone, contact_id: r.contact_id });
      } else state.failed++;
    }
  }
  return { done: state.progress >= list.length, ...state };
}
