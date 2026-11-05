import "server-only";
import { clientForToken } from "@/lib/supabase/token";

// The Redial app sends the member's Supabase access token as
// `Authorization: Bearer …`. Accepts a signed-in member's own session token
// only: not anon or service tokens, not expired ones, and not tokens issued
// to OAuth apps (like the Claude connector), which carry a client_id.
export async function mobileBearer(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i)?.[1];
  if (!token) return null;
  const res = await clientForToken(token).auth.getClaims(token).catch(() => null);
  const c = res?.data?.claims;
  if (!c || res?.error || !c.sub || c.role !== "authenticated" || c.client_id) return null;
  if (typeof c.exp === "number" && c.exp * 1000 <= Date.now()) return null;
  return token;
}
