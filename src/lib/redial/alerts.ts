import "server-only";
import { twilioSms } from "@/lib/comms/twilio";
import { emailHtml, sendEmail } from "@/lib/notify/senders";
import type { createAdminClient } from "@/lib/supabase/admin";
import { lineProtection, type Signal } from "./protection";

// Fraud protection step 4: the family loop. Trusted contacts (a son, daughter
// or caregiver) hear when Redial stops a likely scam, and can get a weekly
// summary. Texts only go to people who replied YES; email goes to the address
// the owner added. Webhooks and the cron call these with the service role.

type Db = ReturnType<typeof createAdminClient>;
type Contact = { id: string; name: string; phone: string | null; email: string | null; sms_consent_at: string | null; opted_out_at: string | null };
const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "your family member";

async function ownerName(db: Db, ownerId: string) {
  const { data } = await db.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
  return first(data?.full_name);
}

// Records the alert first (one per call, contact and channel), so a retry
// never sends twice.
async function claim(db: Db, callId: string, contactId: string, channel: "sms" | "email") {
  const { error } = await db.from("redial_protection_alerts").insert({ call_id: callId, contact_id: contactId, channel });
  return !error;
}

// Alert the line's trusted contacts about a call Redial judged a likely scam.
export async function alertScam(db: Db, callId: string) {
  const { data: call } = await db.from("redial_calls").select("id, line_id, owner_id, verdict, caller_name, purpose, from_number, risk_signals").eq("id", callId).maybeSingle();
  if (!call || call.verdict !== "likely_scam") return 0;
  const p = await lineProtection(db, call.line_id);
  if (!p.enabled) return 0;
  const { data: contacts } = await db.from("redial_trusted_contacts").select("id, name, phone, email, sms_consent_at, opted_out_at")
    .eq("line_id", call.line_id).eq("alert_scams", true).is("opted_out_at", null);
  if (!contacts?.length) return 0;

  const owner = await ownerName(db, call.owner_id);
  const signals = (call.risk_signals ?? []) as Signal[];
  const has = (code: string) => signals.some((s) => s.code === code);
  const { data: blocked } = call.from_number
    ? await db.from("redial_list_entries").select("id").eq("line_id", call.line_id).eq("number", call.from_number).eq("kind", "block").maybeSingle()
    : { data: null };
  const story = [
    `Redial stopped a likely scam call to ${owner}`,
    call.caller_name ? `: someone saying they were ${call.caller_name}` : "",
    call.purpose ? ` (${call.purpose.replace(/\.$/, "")})` : "",
    ".",
  ].join("");
  const safe = has("callback_disproved") ? signals.find((s) => s.code === "callback_disproved") : null;
  const lines = [
    story,
    safe ? "Redial checked with the person they pretended to be, and they're safe." : "",
    blocked ? "The number is now blocked." : "",
    p.warn_on_courier && has("courier_pickup") ? "Don't open the door to anyone sent to collect money or cards; call the police if someone shows up." : "",
    `You may want to check in with ${owner}.`,
  ].filter(Boolean);

  let sent = 0;
  for (const c of contacts as Contact[]) {
    if (c.phone && c.sms_consent_at && (await claim(db, call.id, c.id, "sms"))) {
      const r = await twilioSms(c.phone, `${lines.join(" ")} Reply STOP to stop these texts.`);
      if (r.ok) sent++;
    }
    if (c.email && (await claim(db, call.id, c.id, "email"))) {
      const footer = `You get this because ${owner} added you as a trusted contact on Redial. Ask them to remove you, or reply to this email, to stop.`;
      const r = await sendEmail(c.email, `Redial stopped a likely scam call to ${owner}`,
        emailHtml({ title: `A likely scam call to ${owner} was stopped`, body: lines.join(" "), footer }), `${lines.join("\n\n")}\n\n${footer}`,
        { idempotencyKey: `redial-scam/${call.id}/${c.id}` });
      if (r.ok) sent++;
    }
  }
  return sent;
}

// Sundays from 9 a.m. Arizona time: a summary of the past week for every
// trusted contact who wants one (once a week each; the comms cron runs every
// five minutes, so this fills in through the day).
export async function sendWeeklySummaries(db: Db, now = new Date()) {
  const az = new Date(now.getTime() - 7 * 3600_000); // Arizona has no daylight saving
  if (az.getUTCDay() !== 0 || az.getUTCHours() < 9) return 0;
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
  const sixDays = new Date(now.getTime() - 6 * 24 * 3600_000).toISOString();
  const { data: contacts } = await db.from("redial_trusted_contacts")
    .select("id, line_id, name, phone, email, sms_consent_at, opted_out_at, last_summary_at")
    .eq("weekly_summary", true).is("opted_out_at", null).or(`last_summary_at.is.null,last_summary_at.lt.${sixDays}`).limit(100);
  let sent = 0;
  const stats = new Map<string, { owner: string; text: string } | null>();
  for (const c of contacts ?? []) {
    if (!(c.phone && c.sms_consent_at) && !c.email) continue;
    if (!stats.has(c.line_id)) stats.set(c.line_id, await weekFor(db, c.line_id, weekAgo));
    const s = stats.get(c.line_id);
    await db.from("redial_trusted_contacts").update({ last_summary_at: now.toISOString() }).eq("id", c.id);
    if (!s) continue;
    if (c.phone && c.sms_consent_at && (await twilioSms(c.phone, `${s.text} Reply STOP to stop these texts.`)).ok) sent++;
    if (c.email) {
      const footer = `You get this weekly because ${s.owner} added you as a trusted contact on Redial. Ask them to turn off your weekly summary, or reply to this email, to stop.`;
      const r = await sendEmail(c.email, `Redial: ${s.owner}'s calls this week`, emailHtml({ title: `${s.owner}'s calls this week`, body: s.text, footer }), `${s.text}\n\n${footer}`,
        { idempotencyKey: `redial-weekly/${c.id}/${now.toISOString().slice(0, 10)}` });
      if (r.ok) sent++;
    }
  }
  return sent;
}

async function weekFor(db: Db, lineId: string, since: string) {
  const { data: line } = await db.from("redial_lines").select("owner_id").eq("id", lineId).maybeSingle();
  if (!line || !(await lineProtection(db, lineId)).enabled) return null;
  const owner = await ownerName(db, line.owner_id);
  const { data: calls } = await db.from("redial_calls").select("status, verdict, caller_name, direction").eq("line_id", lineId).gte("started_at", since).limit(1000);
  const inbound = (calls ?? []).filter((c) => (c as { direction?: string }).direction !== "outbound");
  const rang = inbound.filter((c) => ["forwarded", "connected"].includes(c.status)).length;
  const messages = inbound.filter((c) => c.status === "message").length;
  const stopped = inbound.filter((c) => c.verdict === "likely_scam");
  const blocked = inbound.filter((c) => c.status === "blocked").length;
  const parts = [
    `${owner}'s calls this week: ${inbound.length} call${inbound.length === 1 ? "" : "s"}`,
    `${rang} rang through`, `${messages} left a message`,
    `${stopped.length} likely scam${stopped.length === 1 ? "" : "s"} stopped`,
    ...(blocked ? [`${blocked} blocked`] : []),
  ];
  const who = stopped.map((c) => c.caller_name).filter(Boolean).slice(0, 3);
  return { owner, text: `${parts[0]}: ${parts.slice(1).join(", ")}.${who.length ? ` Stopped calls claimed to be: ${who.join(", ")}.` : ""}` };
}
