import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl, toE164 } from "@/lib/notify/senders";
import { secrets } from "@/lib/secrets";

// Twilio for the admin phone (Echo's notification number): REST helpers,
// webhook signature checks and browser call tokens. No SDK on the server.

// Settings from Admin -> Settings -> Integrations, or Coolify.
async function env() {
  const s = await secrets("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET", "TWILIO_TWIML_APP_SID");
  return {
    sid: s.TWILIO_ACCOUNT_SID, token: s.TWILIO_AUTH_TOKEN, from: s.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER,
    keySid: s.TWILIO_API_KEY_SID, keySecret: s.TWILIO_API_KEY_SECRET, app: s.TWILIO_TWIML_APP_SID,
  };
}

export const phoneNumber = async () => (await env()).from ?? null;
export const textsReady = async () => { const e = await env(); return Boolean(e.sid && e.token && e.from); };
export const callsReady = async () => { const e = await env(); return Boolean(e.sid && e.token && e.from && e.keySid && e.keySecret && e.app); };

const auth = (e: { sid?: string; token?: string }) => `Basic ${Buffer.from(`${e.sid}:${e.token}`).toString("base64")}`;
const api = (sid: string | undefined, path: string) => `https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`;

export async function twilioSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; status?: string; error?: string }> {
  const e = await env();
  if (!e.sid || !e.token || !e.from) return { ok: false, error: "Texting isn't set up (Admin → Settings → Integrations → Twilio)." };
  try {
    const res = await fetch(api(e.sid, "/Messages.json"), {
      method: "POST", headers: { Authorization: auth(e), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: e.from, Body: body, StatusCallback: siteUrl("/api/webhooks/twilio/sms-status") }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string };
    return res.ok ? { ok: true, sid: json.sid, status: json.status } : { ok: false, error: json.message ?? `Twilio ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Text failed." };
  }
}

// A form POST (or DELETE) to Twilio's REST API with the account's credentials.
export async function twilioRequest(path: string, params: Record<string, string> = {}, method: "POST" | "DELETE" | "GET" = "POST"): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const e = await env();
  if (!e.sid || !e.token) return { ok: false, status: 0, data: { message: "Twilio isn't set up (Admin → Settings → Integrations → Twilio)." } };
  const qs = method === "GET" && Object.keys(params).length ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(api(e.sid, path) + qs, {
    method, headers: { Authorization: auth(e), ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    ...(method === "POST" ? { body: new URLSearchParams(params) } : {}),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, data: { message: "Couldn't reach Twilio." } };
  const data = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export async function fetchRecording(recordingUrl: string): Promise<Blob | null> {
  const res = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: auth(await env()) } });
  return res.ok ? res.blob() : null;
}

export async function deleteRecording(recordingSid: string) {
  const e = await env();
  await fetch(api(e.sid, `/Recordings/${encodeURIComponent(recordingSid)}.json`), { method: "DELETE", headers: { Authorization: auth(e) } }).catch(() => {});
}

// X-Twilio-Signature: base64 HMAC-SHA1 (auth token) of the full public URL
// followed by each POST param name+value, sorted by name.
export async function verifyTwilio(req: Request): Promise<Record<string, string> | null> {
  const token = (await env()).token;
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
// `opts.app` swaps the outgoing TwiML App (Redial listening uses its own),
// and `incoming: false` makes a token that can only place calls.
export async function voiceToken(identity: string, opts: { app?: string; incoming?: boolean } = {}): Promise<string | null> {
  const e = await env();
  const app = opts.app ?? e.app;
  if (!e.sid || !e.keySid || !e.keySecret || !app) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" }));
  const payload = b64url(JSON.stringify({
    jti: `${e.keySid}-${now}`, iss: e.keySid, sub: e.sid, iat: now, exp: now + 3600,
    grants: { identity, voice: { incoming: { allow: opts.incoming ?? true }, outgoing: { application_sid: app } } },
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
