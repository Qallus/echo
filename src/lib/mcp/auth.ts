import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientForToken } from "@/lib/supabase/token";
import type { AuthInfo } from "@modelcontextprotocol/server";

export type McpUser = { id: string; email: string | null; clientId: string };
// Every tool registered for this request, for tool_search.
export type ToolInfo = { name: string; title: string; description: string; risk: Risk; domain: string };
// read: runs and changes nothing. write: changes something, audited.
// high: deletes, sends to many, money, access: needs a preview and confirm.
export type Risk = "read" | "write" | "high";
export type McpContext = { supabase: SupabaseClient; user: McpUser; catalog: ToolInfo[] };


// Validates `Authorization: Bearer <Supabase access token>`. Returns null for a
// missing, malformed, expired or non-user (anon/service) token.
export async function verifyBearer(req: Request): Promise<AuthInfo | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i)?.[1];
  if (!token) return null;

  // getClaims throws (rather than returning an error) on undecodable tokens.
  const res = await clientForToken(token).auth.getClaims(token).catch(() => null);
  if (!res) return null;
  const { data, error } = res;
  const c = data?.claims;
  if (error || !c?.sub || c.role !== "authenticated") return null;
  if (typeof c.exp === "number" && c.exp * 1000 <= Date.now()) return null;

  return {
    token,
    clientId: typeof c.client_id === "string" ? c.client_id : "",
    scopes: typeof c.scope === "string" ? c.scope.split(" ").filter(Boolean) : [],
    expiresAt: typeof c.exp === "number" ? c.exp : undefined,
    extra: { userId: c.sub, email: typeof c.email === "string" ? c.email : null },
  };
}

export function contextFromAuth(auth: AuthInfo | undefined): McpContext {
  const userId = auth?.extra?.userId;
  if (!auth || typeof userId !== "string") throw new Error("MCP request reached the server without verified auth");
  return {
    supabase: clientForToken(auth.token),
    user: { id: userId, email: (auth.extra?.email as string | null) ?? null, clientId: auth.clientId },
    catalog: [],
  };
}

// In-memory, per-process: 120 calls per user per minute.
const WINDOW_MS = 60_000;
const MAX_CALLS = 120;
const windows = new Map<string, { start: number; count: number }>();

export function rateLimited(userId: string): number | null {
  const now = Date.now();
  const w = windows.get(userId);
  if (!w || now - w.start >= WINDOW_MS) {
    windows.set(userId, { start: now, count: 1 });
    if (windows.size > 10_000) for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k);
    return null;
  }
  w.count += 1;
  return w.count > MAX_CALLS ? Math.ceil((w.start + WINDOW_MS - now) / 1000) : null;
}
