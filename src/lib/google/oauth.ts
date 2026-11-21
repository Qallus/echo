import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { decryptKey, encryptKey } from "@/lib/ai/keys";
import { secrets } from "@/lib/secrets";
import { siteOrigin } from "@/lib/site";
import type { createClient } from "@/lib/supabase/server";

// Connect Google: the OAuth web flow (with PKCE), token refresh and revoke.
// The client ID and secret come from Admin -> Settings -> Integrations
// (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Tokens are stored encrypted in
// account_connections and only ever used on the server.

type Db = Awaited<ReturnType<typeof createClient>>;

export const GOOGLE_CALENDAR_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
export const STATE_COOKIE = "redial_google_oauth";

export async function googleKeys() {
  const k = await secrets("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  return k.GOOGLE_CLIENT_ID && k.GOOGLE_CLIENT_SECRET ? { id: k.GOOGLE_CLIENT_ID, secret: k.GOOGLE_CLIENT_SECRET } : null;
}

export const redirectUri = async () => `${await siteOrigin()}/api/integrations/google/callback`;

const b64url = (b: Buffer) => b.toString("base64url");

// The Google consent URL, plus what the callback needs to check (kept in a
// short-lived, http-only cookie).
export async function authStart(clientId: string, next: string) {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: await redirectUri(), response_type: "code", scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
    code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), cookie: JSON.stringify({ state, verifier, next }) };
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) throw new GoogleAuthError(json.error ?? `http_${res.status}`, json.error_description);
  return json;
}

export class GoogleAuthError extends Error {
  constructor(public code: string, detail?: string) { super(detail ? `${code}: ${detail}` : code); }
}

export async function exchangeCode(code: string, verifier: string) {
  const keys = await googleKeys();
  if (!keys) throw new GoogleAuthError("not_configured");
  const t = await tokenRequest({
    code, code_verifier: verifier, client_id: keys.id, client_secret: keys.secret, redirect_uri: await redirectUri(), grant_type: "authorization_code",
  });
  const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${t.access_token}` }, cache: "no-store" });
  const info = (await who.json().catch(() => ({}))) as { sub?: string; email?: string };
  return { ...t, sub: info.sub ?? null, email: info.email ?? null };
}

export type Connection = {
  id: string; user_id: string; account_email: string | null; access_token: string | null; refresh_token: string | null; expires_at: string | null;
  calendar_id: string; workspace_id: string | null; sync_token: string | null; status: "active" | "error"; last_error: string | null; last_synced_at: string | null;
};
export const CONNECTION_COLS = "id, user_id, account_email, access_token, refresh_token, expires_at, calendar_id, workspace_id, sync_token, status, last_error, last_synced_at";

export const seal = (v: string) => encryptKey(v);

// A working access token for this connection, refreshed when it's about to
// expire. A revoked or expired grant marks the connection so the person can
// reconnect.
export async function accessToken(db: Db, c: Connection): Promise<string> {
  if (c.access_token && c.expires_at && Date.parse(c.expires_at) - Date.now() > 90_000) return decryptKey(c.access_token);
  if (!c.refresh_token) throw new GoogleAuthError("no_refresh_token");
  const keys = await googleKeys();
  if (!keys) throw new GoogleAuthError("not_configured");
  try {
    const t = await tokenRequest({ refresh_token: decryptKey(c.refresh_token), client_id: keys.id, client_secret: keys.secret, grant_type: "refresh_token" });
    const expires = new Date(Date.now() + t.expires_in * 1000).toISOString();
    const patch = { access_token: seal(t.access_token), expires_at: expires, ...(t.refresh_token ? { refresh_token: seal(t.refresh_token) } : {}) };
    await db.from("account_connections").update(patch).eq("id", c.id);
    Object.assign(c, patch);
    return t.access_token;
  } catch (e) {
    if (e instanceof GoogleAuthError && e.code === "invalid_grant") {
      await db.from("account_connections").update({ status: "error", last_error: "Google access was removed or expired. Reconnect Google." }).eq("id", c.id);
    }
    throw e;
  }
}

// Tell Google to forget the grant (best effort; disconnecting still deletes ours).
export async function revoke(c: Pick<Connection, "refresh_token" | "access_token">) {
  const token = c.refresh_token ?? c.access_token;
  if (!token) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptKey(token))}`, { method: "POST", cache: "no-store" });
  } catch { /* ignore */ }
}
