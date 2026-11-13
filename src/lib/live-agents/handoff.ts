import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { xml } from "@/lib/comms/twilio";
import { redialUrl } from "@/lib/redial/twiml";

// Sending a Redial call to the booked Live Agent's Agent Desk (their browser,
// through the Twilio Voice SDK). Used by the Redial call webhooks with the
// service-role client (they verify Twilio's signature first).

export const liveAgentIdentity = (userId: string) => `liveagent_${userId.replace(/-/g, "")}`;

export type Handoff = { engagementId: string; agentId: string; agentUserId: string; workspaceId: string; businessName: string; type: string };

// Today's date where the agent works (shifts and trials are booked by date).
const today = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// The Live Agent covering this line right now, if any: a paid booking routed
// to the line whose agent is live, and either Available now (on-demand and
// monthly) or booked for today (shift, trial).
export async function liveAgentForLine(db: SupabaseClient, lineId: string): Promise<Handoff | null> {
  const { data } = await db.from("live_agent_engagements")
    .select("id, type, starts_on, workspace_id, agent_id, live_agents!inner (user_id, status, available_now, time_zone), live_agent_threads!inner (business_name, blocked_by)")
    .eq("line_id", lineId).eq("status", "active").limit(5);
  type Row = {
    id: string; type: string; starts_on: string | null; workspace_id: string; agent_id: string;
    live_agents: { user_id: string | null; status: string; available_now: boolean; time_zone: string };
    live_agent_threads: { business_name: string; blocked_by: string | null };
  };
  for (const e of (data ?? []) as unknown as Row[]) {
    const a = e.live_agents;
    if (!a.user_id || a.status !== "live" || e.live_agent_threads.blocked_by) continue;
    const on = e.type === "shift" || e.type === "trial" ? e.starts_on === today(a.time_zone) : a.available_now;
    if (!on) continue;
    return { engagementId: e.id, agentId: e.agent_id, agentUserId: a.user_id, workspaceId: e.workspace_id, businessName: e.live_agent_threads.business_name, type: e.type };
  }
  return null;
}

// Starts a call session and returns the TwiML that rings the agent's browser.
// The Dial action comes back to the dial webhook with &agent=<session>.
export async function ringLiveAgent(db: SupabaseClient, h: Handoff, o: { callId: string; lineNumber: string; caller: string | null; reason: string | null }): Promise<string | null> {
  const { data: s } = await db.from("live_agent_call_sessions").insert({
    engagement_id: h.engagementId, agent_id: h.agentId, workspace_id: h.workspaceId, redial_call_id: o.callId, caller_number: o.caller,
  }).select("id").single();
  if (!s) return null;
  const params = [
    ["business", h.businessName], ["engagement", h.engagementId], ["session", s.id], ["caller", o.caller ?? ""], ["reason", o.reason ?? ""],
  ].map(([k, v]) => `<Parameter name="${k}" value="${xml(v.slice(0, 200))}"/>`).join("");
  return `<Say>One moment while I connect you.</Say><Dial timeout="20" callerId="${xml(o.lineNumber)}" action="${xml(redialUrl("dial", o.callId, `&agent=${s.id}`))}"><Client><Identity>${liveAgentIdentity(h.agentUserId)}</Identity>${params}</Client></Dial>`;
}
