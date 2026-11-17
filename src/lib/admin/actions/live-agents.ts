"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { stripe } from "@/lib/billing/stripe";
import { isUuid, requireUser } from "@/lib/data";
import { deliver } from "@/lib/comms/email";
import { sendText } from "@/lib/admin/actions/comms-phone";
import { BULK_DECISIONS, decideMany, deleteMany, listAdminAgents, notifyAgents, updateAgent, type AgentPatch, type BulkDecision } from "@/lib/live-agents/admin";
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

// ---------------------------------------------------------------------------
// Managing many agents at once (Admin → Live Agents views and quick actions).
// ---------------------------------------------------------------------------

const BULK_DONE: Record<BulkDecision, (n: number) => string> = {
  approve: (n) => `Approved ${n}. ${n === 1 ? "The profile is" : "Their profiles are"} live.`,
  suspend: (n) => `Blocked ${n}. ${n === 1 ? "The profile is" : "Their profiles are"} hidden and locked.`,
  restore: (n) => `Unblocked ${n}.`,
  archive: (n) => `Archived ${n}.`,
  unarchive: (n) => `Restored ${n} from the archive.`,
};

const pickIds = (ids: string[]) => [...new Set(ids)].filter(isUuid).slice(0, 500);
const report = (ok: string, errors: string[]): Result => (errors.length ? { error: [ok, ...errors].filter(Boolean).join(" ") } : { ok });

export async function bulkLiveAgents(ids: string[], decision: BulkDecision, note?: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  const list = pickIds(ids);
  if (!list.length || !BULK_DECISIONS.includes(decision)) return { error: "Select at least one agent." };
  const supabase = await createClient();
  const { done, errors } = await decideMany(supabase, list, decision, note);
  if (done.length) await adminAudit(supabase, `live_agents.bulk_${decision}`, { type: "live_agent", id: done.length === 1 ? done[0] : "many" }, { ids: done, ...(note ? { note: note.slice(0, 300) } : {}) });
  revalidatePath("/admin/live-agents");
  revalidatePath("/live-agents", "layout");
  return report(done.length ? BULK_DONE[decision](done.length) : "", errors);
}

export async function deleteLiveAgents(ids: string[]): Promise<Result> {
  await requireStaff("marketplace.manage");
  const list = pickIds(ids);
  if (!list.length) return { error: "Select at least one agent." };
  const supabase = await createClient();
  const { done, errors } = await deleteMany(supabase, list);
  if (done.length) await adminAudit(supabase, "live_agents.delete", { type: "live_agent", id: done.length === 1 ? done[0].id : "many" }, { deleted: done });
  revalidatePath("/admin/live-agents");
  revalidatePath("/live-agents", "layout");
  return report(done.length ? `Deleted ${done.length}.` : "", errors);
}

export async function updateLiveAgent(id: string, patch: AgentPatch): Promise<Result> {
  await requireStaff("marketplace.manage");
  if (!isUuid(id)) return { error: "Profile not found." };
  const supabase = await createClient();
  const r = await updateAgent(supabase, id, patch);
  if ("error" in r) return { error: r.error };
  await adminAudit(supabase, "live_agents.edit", { type: "live_agent", id }, { fields: r.ok });
  revalidatePath("/admin/live-agents");
  revalidatePath("/live-agents", "layout");
  return { ok: "Saved." };
}

// A message from the Redial team: their notifications, and email/SMS by
// each agent's own notification settings.
export async function messageLiveAgents(ids: string[], title: string, body: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  const list = pickIds(ids);
  if (!list.length) return { error: "Select at least one agent." };
  const supabase = await createClient();
  const r = await notifyAgents(supabase, list, title, body);
  if ("error" in r) return { error: r.error };
  await adminAudit(supabase, "live_agents.message", { type: "live_agent", id: list.length === 1 ? list[0] : "many" }, { ids: list, sent: r.sent, title: title.slice(0, 120) });
  const skipped = list.length - r.sent;
  return { ok: `Sent to ${r.sent}.${skipped ? ` ${skipped} demo profile${skipped === 1 ? " has" : "s have"} no account and ${skipped === 1 ? "was" : "were"} skipped.` : ""}` };
}

async function agentsByIds(ids: string[]) {
  const supabase = await createClient();
  const { agents } = await listAdminAgents(supabase);
  const set = new Set(ids);
  return { supabase, agents: agents.filter((a) => set.has(a.id)) };
}

// Email from Redial (Resend), logged in Communications → Email.
export async function emailLiveAgents(ids: string[], subject: string, body: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  await requireStaff("comms.manage");
  const list = pickIds(ids);
  if (!list.length) return { error: "Select at least one agent." };
  if (!subject.trim() || !body.trim()) return { error: "Add a subject and a message." };
  const { supabase, agents } = await agentsByIds(list);
  const emails = [...new Set(agents.map((a) => a.email).filter((e): e is string => Boolean(e)))];
  if (!emails.length) return { error: "None of these agents has an email address (demo profiles have no account)." };
  const me = await requireUser();
  const out = await deliver(supabase, { subject: subject.trim().slice(0, 200), body: body.trim().slice(0, 10000) }, { emails }, { via: "admin", me: { id: me.id, email: me.email ?? null } });
  if ("error" in out && out.error) return { error: out.error };
  const skipped = agents.length - emails.length;
  return { ok: `Email sent to ${emails.length}.${skipped ? ` ${skipped} without an email address skipped.` : ""}` };
}

// Texts from Redial's number, one per agent with a phone on their profile.
export async function textLiveAgents(ids: string[], body: string): Promise<Result> {
  await requireStaff("marketplace.manage");
  await requireStaff("comms.manage");
  const list = pickIds(ids).slice(0, 50);
  if (!list.length) return { error: "Select at least one agent." };
  if (!body.trim()) return { error: "Write a message." };
  const { agents } = await agentsByIds(list);
  const withPhone = agents.filter((a) => a.phone);
  if (!withPhone.length) return { error: "None of these agents has a phone number on their profile." };
  let sent = 0;
  const errors: string[] = [];
  for (const a of withPhone) {
    const r = await sendText({ to: a.phone!, body });
    if (r.error) errors.push(`${a.name}: ${r.error}`); else sent++;
  }
  const skipped = agents.length - withPhone.length;
  return report(`Texted ${sent}.${skipped ? ` ${skipped} without a phone number skipped.` : ""}`, errors);
}
