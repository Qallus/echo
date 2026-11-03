import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl, toE164 } from "@/lib/notify/senders";

// Twilio for the admin phone (Echo's notification number): REST helpers,
// webhook signature checks and browser call tokens. No SDK on the server.

const env = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER,
  keySid: process.env.TWILIO_API_KEY_SID, keySecret: process.env.TWILIO_API_KEY_SECRET, app: process.env.TWILIO_TWIML_APP_SID,
});

export const phoneNumber = () => env().from ?? null;
export const textsReady = () => { const e = env(); return Boolean(e.sid && e.token && e.from); };
export const callsReady = () => { const e = env(); return Boolean(e.sid && e.token && e.from && e.keySid && e.keySecret && e.app); };

const auth = () => { const e = env(); return `Basic ${Buffer.from(`${e.sid}:${e.token}`).toString("base64")}`; };
const api = (path: string) => `https://api.twilio.com/2010-04-01/Accounts/${env().sid}${path}`;

export async function twilioSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; status?: string; error?: string }> {
  const e = env();
  if (!e.sid || !e.token || !e.from) return { ok: false, error: "Texting isn't set up (TWILIO_* in Coolify)." };
  try {
    const res = await fetch(api("/Messages.json"), {
      method: "POST", headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: e.from, Body: body, StatusCallback: siteUrl("/api/webhooks/twilio/sms-status") }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string };
    return res.ok ? { ok: true, sid: json.sid, status: json.status } : { ok: false, error: json.message ?? `Twilio ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Text failed." };
  }
}

export async function fetchRecording(recordingUrl: string): Promise<Blob | null> {
  const res = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: auth() } });
  return res.ok ? res.blob() : null;
}

export async function deleteRecording(recordingSid: string) {
  await fetch(api(`/Recordings/${encodeURIComponent(recordingSid)}.json`), { method: "DELETE", headers: { Authorization: auth() } }).catch(() => {});
}

// X-Twilio-Signature: base64 HMAC-SHA1 (auth token) of the full public URL
// followed by each POST param name+value, sorted by name.
export async function verifyTwilio(req: Request): Promise<Record<string, string> | null> {
  const token = env().token;
  const sig = req.headers.get("x-twilio-signature");
  if (!token || !sig) return null;
  const params = Object.fromEntries(new URLSearchParams(await req.text()));
  const u = new URL(req.url);
  const url = siteUrl(`${u.pathname}${u.search}`);
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = Buffer.from(createHmac("sha1", token).update(data).digest("base64"));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? params : null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

// A one-hour Voice access token for the browser phone (identity per staff member).
export function voiceToken(identity: string): string | null {
  const e = env();
  if (!e.sid || !e.keySid || !e.keySecret || !e.app) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" }));
  const payload = b64url(JSON.stringify({
    jti: `${e.keySid}-${now}`, iss: e.keySid, sub: e.sid, iat: now, exp: now + 3600,
    grants: { identity, voice: { incoming: { allow: true }, outgoing: { application_sid: e.app } } },
  }));
  const signature = b64url(createHmac("sha256", e.keySecret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

export const identityFor = (userId: string) => `staff_${userId.replace(/-/g, "")}`;
export const userFromIdentity = (identity: string) => {
  const hex = identity.replace(/^client:/, "").replace(/^staff_/, "");
  return /^[0-9a-f]{32}$/.test(hex) ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
};

export const e164 = (raw: string | null | undefined) => (raw ? toE164(raw) : null);
const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

// The CRM contact for a phone number (last 10 digits match), if any.
export async function contactForNumber(supabase: SupabaseClient, number: string): Promise<{ id: string; company_id: string | null } | null> {
  const digits = last10(number);
  if (digits.length < 7) return null;
  const { data } = await supabase.from("crm_contacts").select("id, company_id, phone").not("phone", "is", null).ilike("phone", `%${digits.slice(-4)}%`).limit(200);
  return (data ?? []).find((c) => last10(c.phone) === digits) ?? null;
}

export const twiml = (inner: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { "content-type": "text/xml" } });
export const xml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
