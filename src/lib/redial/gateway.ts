import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { secrets } from "@/lib/secrets";

// The voice gateway (voice-gateway/ in this repo, its own Coolify service)
// bridges a call's audio to xAI. Calls carry a signed, short-lived token;
// the gateway's requests back to Echo are signed with the same secret.

export async function gatewayConfig() {
  const s = await secrets("REDIAL_GATEWAY_URL", "REDIAL_GATEWAY_SECRET", "XAI_API_KEY", "REDIAL_AI_APP_SID");
  const url = s.REDIAL_GATEWAY_URL?.replace(/\/$/, "") ?? null;
  // aiApp: the TwiML App the AI joins conference calls through (step 2).
  const aiApp = /^AP[0-9a-f]{32}$/i.test(s.REDIAL_AI_APP_SID ?? "") ? s.REDIAL_AI_APP_SID! : null;
  return { url, secret: s.REDIAL_GATEWAY_SECRET ?? null, xaiKey: s.XAI_API_KEY ?? null, aiApp, ready: Boolean(url && s.REDIAL_GATEWAY_SECRET && s.XAI_API_KEY) };
}

const mac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// "<callId>.<expiry>.<hmac>", valid for 10 minutes (long enough to answer).
export function callToken(secret: string, callId: string) {
  const exp = Math.floor(Date.now() / 1000) + 600;
  return `${callId}.${exp}.${mac(secret, `${callId}.${exp}`)}`;
}

export function readCallToken(secret: string, token: string): string | null {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  return same(mac(secret, `${id}.${exp}`), sig) ? id : null;
}

// Insider: a member's ticket to join one live call as a muted listener,
// "<session>.<user>.<expiry>.<hmac>", valid for two minutes. Issued after an
// RLS-checked permission check; the joining webhook checks it again.
export function listenTicket(secret: string, sessionId: string, userId: string) {
  const exp = Math.floor(Date.now() / 1000) + 120;
  return `${sessionId}.${userId}.${exp}.${mac(secret, `listen.${sessionId}.${userId}.${exp}`)}`;
}

export function readListenTicket(secret: string, ticket: string): { sessionId: string; userId: string } | null {
  const [sessionId, userId, exp, sig] = ticket.split(".");
  if (!sessionId || !userId || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  return same(mac(secret, `listen.${sessionId}.${userId}.${exp}`), sig) ? { sessionId, userId } : null;
}

// Echo -> gateway control (POST <gateway>/control), signed the same way.
// "stop" ends the AI on one call at once (takeover); "direct" passes a
// private direction (Audible). False if the gateway couldn't be reached or
// didn't have the call.
export async function gatewayControl(callId: string, action: "stop" | "direct", extra: { id?: string; text?: string } = {}): Promise<boolean> {
  const { url, secret } = await gatewayConfig();
  if (!url || !secret) return false;
  const body = JSON.stringify({ callId, action, ...extra });
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${url.replace(/^ws/, "http")}/control`, {
    method: "POST", headers: { "content-type": "application/json", "x-redial-timestamp": ts, "x-redial-signature": mac(secret, `${ts}.${body}`) }, body,
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);
  const data = res?.ok ? ((await res.json().catch(() => ({}))) as { found?: boolean }) : null;
  return Boolean(data?.found);
}

// Gateway -> Echo requests: header x-redial-signature = hmac(timestamp.body),
// x-redial-timestamp within five minutes.
export async function verifyGateway(req: Request): Promise<unknown | null> {
  const { secret } = await gatewayConfig();
  const ts = req.headers.get("x-redial-timestamp") ?? "";
  const sig = req.headers.get("x-redial-signature") ?? "";
  const body = await req.text();
  if (!secret || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return null;
  if (!same(mac(secret, `${ts}.${body}`), sig)) return null;
  try { return JSON.parse(body); } catch { return null; }
}
