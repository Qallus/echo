import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { secrets } from "@/lib/secrets";

// The voice gateway (voice-gateway/ in this repo, its own Coolify service)
// bridges a call's audio to xAI. Calls carry a signed, short-lived token;
// the gateway's requests back to Echo are signed with the same secret.

export async function gatewayConfig() {
  const s = await secrets("REDIAL_GATEWAY_URL", "REDIAL_GATEWAY_SECRET", "XAI_API_KEY");
  const url = s.REDIAL_GATEWAY_URL?.replace(/\/$/, "") ?? null;
  return { url, secret: s.REDIAL_GATEWAY_SECRET ?? null, xaiKey: s.XAI_API_KEY ?? null, ready: Boolean(url && s.REDIAL_GATEWAY_SECRET && s.XAI_API_KEY) };
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
