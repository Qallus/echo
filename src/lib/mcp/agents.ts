import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// AI agents (Paperclip, Hermes, OpenClaw, Herdr...) connect with an API key
// instead of OAuth. Each agent is a real user, agent-<handle>@agents.redial.si,
// and the secret part of its key is that user's password. The MCP signs the
// agent in with it, so every call runs as the agent under RLS like any other
// user; the agent's own limits (agents table) are checked on every call.
//   Key: rdk_<handle>_<secret>

export const AGENT_DOMAIN = "agents.redial.si";
export const agentEmail = (handle: string) => `agent-${handle}@${AGENT_DOMAIN}`;
const KEY = /^rdk_([a-f0-9]{12})_([A-Za-z0-9_-]{32})$/;

export function newAgentKey(handle = randomBytes(6).toString("hex")) {
  const secret = randomBytes(24).toString("base64url");
  return { handle, secret, key: `rdk_${handle}_${secret}`, hint: `rdk_${handle}_…${secret.slice(-4)}` };
}

export const isAgentKey = (token: string) => token.startsWith("rdk_");
export const handleOf = (hint: string | null) => hint?.match(/^rdk_([a-f0-9]{12})_/)?.[1] ?? null;

export type AgentPolicy = {
  id: string; user_id: string; name: string; harness: string; permissions: string[]; read_only: boolean; domains: string[];
  approval_tools: string[]; caps: { writes?: number; high?: number }; ip_allowlist: string[]; active: boolean;
  expires_at: string | null; key_rotated_at: string;
};

// Signed-in sessions per key, so agents don't sign in on every call. A key
// rotation or pause is caught by the agents row check on each request.
const sessions = new Map<string, { token: string; until: number; at: number }>();

export async function agentSession(key: string): Promise<{ token: string; at: number } | null> {
  const m = key.match(KEY);
  if (!m) return null;
  const id = createHash("sha256").update(key).digest("hex");
  const hit = sessions.get(id);
  if (hit && hit.until > Date.now()) return hit;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: agentEmail(m[1]), password: m[2] });
  if (error || !data.session) { sessions.delete(id); return null; }
  const entry = { token: data.session.access_token, until: (data.session.expires_at ?? 0) * 1000 - 60_000, at: Date.now() };
  sessions.set(id, entry);
  if (sessions.size > 1000) for (const [k, v] of sessions) if (v.until <= Date.now()) sessions.delete(k);
  return entry;
}

// The caller's address for the IP allowlist (Coolify's proxy sets x-forwarded-for).
export const requestIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
