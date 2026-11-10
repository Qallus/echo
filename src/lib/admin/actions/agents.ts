"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/guard";
import { agentEmail, handleOf, newAgentKey } from "@/lib/mcp/agents";
import { HARNESSES } from "@/lib/mcp/agent-areas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Admin > AI > Agents. Settings go through admin_agent_save (staff-checked,
// audited). An agent's sign-in user is created, re-keyed and deleted with the
// service-role client, only after requireStaff and the audited database call
// (the Super Admin auth exception in CLAUDE.md).

type Result = { ok?: string; error?: string; key?: string };
const PATH = "/admin/ai/agents";

export type AgentSettings = {
  name: string; harness: string; permissions: string[]; read_only: boolean; domains: string[]; approval_tools: string[];
  caps: { writes: number; high: number }; ip_allowlist: string[]; expires_at: string | null;
};

function clean(s: AgentSettings) {
  const name = s.name.trim().slice(0, 80);
  if (!name) return { error: "Give the agent a name." } as const;
  if (!HARNESSES.some((h) => h.id === s.harness)) return { error: "Pick where the agent runs." } as const;
  const n = (x: number, max: number) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
  const ips = s.ip_allowlist.map((x) => x.trim()).filter(Boolean);
  if (ips.some((ip) => !/^[0-9a-fA-F:.]{3,45}$/.test(ip))) return { error: "IP allowlist: one IP address per line." } as const;
  return {
    settings: {
      name, harness: s.harness, permissions: [...new Set(s.permissions)], read_only: s.read_only, domains: [...new Set(s.domains)],
      approval_tools: [...new Set(s.approval_tools.map((t) => t.trim()).filter((t) => /^[a-z0-9_]{1,80}$/.test(t)))].slice(0, 200),
      caps: { writes: n(s.caps.writes, 100_000), high: n(s.caps.high, 10_000) }, ip_allowlist: ips.slice(0, 50),
      expires_at: s.expires_at || "",
    },
  } as const;
}

// Creates the agent and returns its key. The key is shown once and never stored.
export async function createAgent(input: AgentSettings): Promise<Result> {
  await requireStaff("staff.manage");
  const c = clean(input);
  if ("error" in c) return { error: c.error };
  const k = newAgentKey();
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: agentEmail(k.handle), password: k.secret, email_confirm: true, user_metadata: { full_name: c.settings.name, is_agent: true },
  });
  if (error || !created.user) return { error: error?.message ?? "Couldn't create the agent's account." };
  const supabase = await createClient();
  const { error: saveError } = await supabase.rpc("admin_agent_save", { p_id: null, p_user: created.user.id, p_settings: { ...c.settings, key_hint: k.hint } });
  if (saveError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: saveError.message };
  }
  revalidatePath(PATH);
  return { ok: `${c.settings.name} is ready. Copy its key now: it won't be shown again.`, key: k.key };
}

export async function updateAgent(id: string, input: AgentSettings): Promise<Result> {
  await requireStaff("staff.manage");
  const c = clean(input);
  if ("error" in c) return { error: c.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_agent_save", { p_id: id, p_user: null, p_settings: c.settings });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: "Saved. It applies to the agent's next call." };
}

export async function setAgentActive(id: string, active: boolean): Promise<Result> {
  await requireStaff("staff.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_agent_save", { p_id: id, p_user: null, p_settings: { active } });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: active ? "Agent resumed." : "Agent paused. Its key stops working now." };
}

// A new key; the old one stops working on the agent's next call.
export async function rotateAgentKey(id: string): Promise<Result> {
  await requireStaff("staff.manage");
  const supabase = await createClient();
  const { data: agent } = await supabase.from("agents").select("user_id, key_hint").eq("id", id).maybeSingle();
  const handle = handleOf(agent?.key_hint ?? null);
  if (!agent || !handle) return { error: "Agent not found." };
  const k = newAgentKey(handle);
  const { error } = await supabase.rpc("admin_agent_save", { p_id: id, p_user: null, p_settings: { key_hint: k.hint } });
  if (error) return { error: error.message };
  const { error: authError } = await createAdminClient().auth.admin.updateUserById(agent.user_id, { password: k.secret });
  if (authError) return { error: authError.message };
  revalidatePath(PATH);
  return { ok: "New key made. Copy it now: it won't be shown again. The old key has stopped working.", key: k.key };
}

export async function removeAgent(id: string): Promise<Result> {
  await requireStaff("staff.manage");
  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("admin_agent_remove", { p_id: id });
  if (error) return { error: error.message };
  const { error: authError } = await createAdminClient().auth.admin.deleteUser(userId as string);
  if (authError) return { error: `Paused, but couldn't delete its account: ${authError.message}` };
  revalidatePath(PATH);
  return { ok: "Agent removed." };
}

export async function pauseAllAgents(): Promise<Result> {
  await requireStaff("staff.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("agents").select("id").eq("active", true);
  for (const a of data ?? []) {
    const { error } = await supabase.rpc("admin_agent_save", { p_id: a.id, p_user: null, p_settings: { active: false } });
    if (error) return { error: error.message };
  }
  revalidatePath(PATH);
  return { ok: `Paused ${data?.length ?? 0} agents.` };
}

export async function decideApproval(id: string, approve: boolean): Promise<Result> {
  await requireStaff("staff.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_agent_decide", { p_id: id, p_approve: approve });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: approve ? "Approved. The agent can run it now." : "Declined." };
}
