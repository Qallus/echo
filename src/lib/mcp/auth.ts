import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientForToken } from "@/lib/supabase/token";
import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { agentSession, isAgentKey, requestIp, type AgentPolicy } from "./agents";

export type McpUser = { id: string; email: string | null; clientId: string };
// Every tool registered for this request, for tool_search.
export type ToolInfo = { name: string; title: string; description: string; risk: Risk; domain: string };
// read: runs and changes nothing. write: changes something, audited.
// high: deletes, sends to many, money, access: needs a preview and confirm.
export type Risk = "read" | "write" | "high";
export type McpContext = {
  supabase: SupabaseClient; user: McpUser; catalog: ToolInfo[];
  // Set when the caller is an AI agent (API key): its limits apply to every call.
  agent: AgentPolicy | null;
  // Each tool's audited entry point, so approval_run can run an approved call.
  handlers: Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>>;
  // The tool an approved request is running right now (skips asking again).
  approvedRun?: string;
};


// Validates `Authorization: Bearer <Supabase access token>` (people, via
// OAuth) or `Bearer rdk_...` (an agent's API key). Returns null for a missing,
// malformed, expired or non-user (anon/service) token, and for an agent that's
// paused, expired, rotated or calling from outside its IP allowlist.
export async function verifyBearer(req: Request): Promise<AuthInfo | null> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i)?.[1];
  if (!bearer) return null;
  if (isAgentKey(bearer)) return verifyAgent(req, bearer);
  const token = bearer;

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

async function verifyAgent(req: Request, key: string): Promise<AuthInfo | null> {
  const session = await agentSession(key);
  if (!session) return null;
  const client = clientForToken(session.token);
  const { data: claims } = await client.auth.getClaims(session.token).catch(() => ({ data: null }));
  const sub = claims?.claims?.sub;
  if (!sub) return null;
  const { data: agent } = await client.from("agents").select("*").eq("user_id", sub).maybeSingle<AgentPolicy>();
  if (!agent?.active || (agent.expires_at && new Date(agent.expires_at) <= new Date())) return null;
  if (new Date(agent.key_rotated_at).getTime() > session.at) return null; // signed in with a key that's since been replaced
  if (agent.ip_allowlist.length && !agent.ip_allowlist.includes(requestIp(req))) return null;
  return {
    token: session.token, clientId: `agent:${agent.id}`, scopes: [],
    extra: { userId: sub, email: claims?.claims?.email ?? null, agent },
  };
}

export function contextFromAuth(auth: AuthInfo | undefined): McpContext {
  const userId = auth?.extra?.userId;
  if (!auth || typeof userId !== "string") throw new Error("MCP request reached the server without verified auth");
  return {
    supabase: clientForToken(auth.token),
    user: { id: userId, email: (auth.extra?.email as string | null) ?? null, clientId: auth.clientId },
    catalog: [],
    agent: (auth.extra?.agent as AgentPolicy | undefined) ?? null,
    handlers: new Map(),
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
