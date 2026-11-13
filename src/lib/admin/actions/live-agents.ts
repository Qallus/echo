"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };
const DECISIONS = ["approve", "return", "suspend", "restore", "approve_clip", "reject_clip"] as const;
type Decision = (typeof DECISIONS)[number];
const DONE: Record<Decision, string> = {
  approve: "Approved. The profile is live.", return: "Sent back with your note.", suspend: "Suspended.", restore: "Restored.",
  approve_clip: "Clip approved.", reject_clip: "Clip rejected.",
};

// Review a Live Agent profile or one of its voice clips. The database
// checks marketplace.manage again and notifies the agent.
export async function reviewLiveAgent(target: string, decision: Decision, note?: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  if (!isUuid(target) || !DECISIONS.includes(decision)) return { error: "Choose an action." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_live_agent", { target, decision, note: note?.trim().slice(0, 1000) || null });
  if (error) return { error: error.code === "22023" ? error.message : "Couldn't save that. Try again." };
  await adminAudit(supabase, `live_agents.${decision}`, { type: decision.endsWith("clip") ? "live_agent_voice_sample" : "live_agent", id: target }, note ? { note: note.slice(0, 300) } : {});
  revalidatePath("/admin/live-agents");
  revalidatePath("/live-agents", "layout");
  return { ok: DONE[decision] };
}

export async function resolveLiveAgentReport(id: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  if (!isUuid(id)) return { error: "Report not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_live_agent_report", { report: id });
  if (error) return { error: "Couldn't save that. Try again." };
  await adminAudit(supabase, "live_agents.report_resolved", { type: "live_agent_report", id });
  revalidatePath("/admin/live-agents");
  return { ok: "Marked resolved." };
}
