"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { stripe } from "@/lib/billing/stripe";
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

// Refund a Live Agent payment in full through Stripe. The webhook records it
// and cancels the payout if it hasn't been sent.
export async function refundLiveAgentPayment(paymentIntent: string, engagementId: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntent) || !isUuid(engagementId)) return { error: "Payment not found." };
  const s = await stripe();
  if (!s) return { error: "Stripe isn't set up." };
  try {
    await s.refunds.create({ payment_intent: paymentIntent, metadata: { live_agent_engagement: engagementId } }, { idempotencyKey: `live-agent-refund-${engagementId}` });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe couldn't refund that." };
  }
  const supabase = await createClient();
  await adminAudit(supabase, "live_agents.refund", { type: "live_agent_engagement", id: engagementId }, { payment_intent: paymentIntent });
  revalidatePath("/admin/live-agents");
  return { ok: "Refund sent. It shows here once Stripe confirms." };
}

export async function setLiveAgentPayout(payout: string, action: "release" | "hold" | "cancel"): Promise<Result> {
  await requireStaff("marketplace.manage");
  if (!isUuid(payout) || !["release", "hold", "cancel"].includes(action)) return { error: "Payout not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_live_agent_payout", { payout, action });
  if (error) return { error: "Couldn't save that. Try again." };
  await adminAudit(supabase, `live_agents.payout_${action}`, { type: "live_agent_payout", id: payout });
  revalidatePath("/admin/live-agents");
  return { ok: action === "release" ? "Released. It goes out on the next payout run." : action === "hold" ? "Held." : "Cancelled." };
}
