import "server-only";
import { cache } from "react";
import { getUser, listWorkspaces } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "./data";

// Reads for the Live Agents inbox (/messages), as the signed-in person. RLS
// shows a thread to the agent and to the business's owners and admins.

export type Side = "business" | "agent";
export type EngagementType = "on_demand" | "shift" | "retainer" | "trial";
export type EngagementStatus = "offered" | "accepted" | "declined" | "withdrawn" | "replaced" | "active" | "completed" | "cancelled";

export type Engagement = {
  id: string; threadId: string; workspaceId: string; agentId: string; type: EngagementType; status: EngagementStatus; offeredBy: Side;
  rateCents: number; hours: number | null; startsOn: string | null; endsOn: string | null; schedule: string | null; script: string | null;
  businessFeePct: number; agentFeePct: number; replaces: string | null; createdAt: string; respondedAt: string | null;
  paidAt: string | null; completedAt: string | null; disputedAt: string | null; lineId: string | null;
};
export type Message = { id: string; side: Side | "system"; kind: "text" | "offer" | "system"; body: string; masked: boolean; engagementId: string | null; createdAt: string; mine: boolean };
export type ThreadSummary = {
  id: string; side: Side; title: string; subtitle: string; avatarUrl: string | null; handle: string | null; lastMessageAt: string;
  preview: string; unread: boolean; openOffers: number; booked: number; blocked: boolean;
};
export type Review = { engagementId: string; side: Side; rating: number; body: string | null; revealed: boolean; mine: boolean };
export type Thread = ThreadSummary & { workspaceId: string; agentId: string; agentUserId: string | null; messages: Message[]; engagements: Engagement[]; reviews: Review[] };

type ThreadRow = {
  id: string; workspace_id: string; agent_id: string; business_name: string; last_message_at: string; business_read_at: string; agent_read_at: string | null; blocked_by: string | null;
  live_agents: { display_name: string; headline: string; handle: string; avatar_url: string | null; user_id: string | null } | null;
};
type EngagementRow = {
  id: string; thread_id: string; workspace_id: string; agent_id: string; type: EngagementType; status: EngagementStatus; offered_by: Side; rate_cents: number;
  hours: number | null; starts_on: string | null; ends_on: string | null; schedule: string | null; script: string | null; business_fee_pct: number;
  agent_fee_pct: number; replaces: string | null; created_at: string; responded_at: string | null;
  paid_at?: string | null; completed_at?: string | null; disputed_at?: string | null; line_id?: string | null;
};

const THREAD_COLS = "id, workspace_id, agent_id, business_name, last_message_at, business_read_at, agent_read_at, blocked_by, live_agents (display_name, headline, handle, avatar_url, user_id)";
const ENG_COLS = "id, thread_id, workspace_id, agent_id, type, status, offered_by, rate_cents, hours, starts_on, ends_on, schedule, script, business_fee_pct, agent_fee_pct, replaces, created_at, responded_at, paid_at, completed_at, disputed_at, line_id";

export const toEngagement = (e: EngagementRow): Engagement => ({
  id: e.id, threadId: e.thread_id, workspaceId: e.workspace_id, agentId: e.agent_id, type: e.type, status: e.status, offeredBy: e.offered_by,
  rateCents: e.rate_cents, hours: e.hours == null ? null : Number(e.hours), startsOn: e.starts_on, endsOn: e.ends_on, schedule: e.schedule, script: e.script,
  businessFeePct: Number(e.business_fee_pct), agentFeePct: Number(e.agent_fee_pct), replaces: e.replaces, createdAt: e.created_at, respondedAt: e.responded_at,
  paidAt: e.paid_at ?? null, completedAt: e.completed_at ?? null, disputedAt: e.disputed_at ?? null, lineId: e.line_id ?? null,
});

function summarize(t: ThreadRow, me: string, last: { body: string; side: string } | undefined, engs: Engagement[]): ThreadSummary {
  const side: Side = t.live_agents?.user_id === me ? "agent" : "business";
  const readAt = side === "agent" ? t.agent_read_at : t.business_read_at;
  return {
    id: t.id, side,
    title: side === "agent" ? t.business_name : t.live_agents?.display_name ?? "Live Agent",
    subtitle: side === "agent" ? "Business" : t.live_agents?.headline ?? "",
    avatarUrl: side === "business" && t.live_agents?.avatar_url ? mediaUrl(t.live_agents.avatar_url) : null,
    handle: t.live_agents?.handle ?? null,
    lastMessageAt: t.last_message_at,
    preview: last ? `${last.side === side ? "You: " : ""}${last.body}` : "",
    unread: !readAt || new Date(t.last_message_at) > new Date(readAt),
    openOffers: engs.filter((e) => e.status === "offered").length,
    booked: engs.filter((e) => e.status === "accepted" || e.status === "active").length,
    blocked: Boolean(t.blocked_by),
  };
}

// Every conversation I'm in, newest first (null when messaging isn't set up).
export const listThreads = cache(async (): Promise<ThreadSummary[] | null> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_agent_threads").select(THREAD_COLS).order("last_message_at", { ascending: false }).limit(200);
  if (error) return null;
  const rows = data as unknown as ThreadRow[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: msgs }, { data: engs }] = await Promise.all([
    supabase.from("live_agent_messages").select("thread_id, body, sender_side, created_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(1000),
    supabase.from("live_agent_engagements").select(ENG_COLS).in("thread_id", ids),
  ]);
  const lastBy = new Map<string, { body: string; side: string }>();
  for (const m of msgs ?? []) if (!lastBy.has(m.thread_id)) lastBy.set(m.thread_id, { body: m.body, side: m.sender_side });
  const engBy = (id: string) => ((engs ?? []) as EngagementRow[]).filter((e) => e.thread_id === id).map(toEngagement);
  return rows.map((r) => summarize(r, user.id, lastBy.get(r.id), engBy(r.id)));
});

export async function getThread(id: string): Promise<Thread | null> {
  const user = await getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("live_agent_threads").select(THREAD_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const t = data as unknown as ThreadRow;
  const [{ data: msgs }, { data: engs }, { data: revs }] = await Promise.all([
    supabase.from("live_agent_messages").select("id, sender_side, sender_id, kind, body, masked, engagement_id, created_at").eq("thread_id", id).order("created_at").limit(500),
    supabase.from("live_agent_engagements").select(ENG_COLS).eq("thread_id", id).order("created_at"),
    supabase.from("live_agent_reviews").select("engagement_id, author_side, author_id, rating, body, revealed_at").eq("thread_id", id),
  ]);
  const engagements = ((engs ?? []) as EngagementRow[]).map(toEngagement);
  const last = msgs?.at(-1);
  const summary = summarize(t, user.id, last ? { body: last.body, side: last.sender_side } : undefined, engagements);
  return {
    ...summary, workspaceId: t.workspace_id, agentId: t.agent_id, agentUserId: t.live_agents?.user_id ?? null, engagements,
    reviews: (revs ?? []).map((r) => ({ engagementId: r.engagement_id, side: r.author_side, rating: r.rating, body: r.body, revealed: Boolean(r.revealed_at), mine: r.author_id === user.id })),
    messages: (msgs ?? []).map((m) => ({
      id: m.id, side: m.sender_side, kind: m.kind, body: m.body, masked: m.masked, engagementId: m.engagement_id, createdAt: m.created_at,
      mine: m.sender_id === user.id,
    })),
  };
}

// Workspaces the signed-in person can hire for (owner or admin), Business first.
export async function hiringWorkspaces(): Promise<{ id: string; name: string }[]> {
  if (!(await getUser())) return [];
  return (await listWorkspaces()).filter((w) => w.role === "owner" || w.role === "admin").map((w) => ({ id: w.id, name: w.isPersonal ? "Personal" : w.name }));
}

// All engagements for the workspaces I hire for (the /hiring page) or as an agent.
export async function myEngagements(): Promise<(Engagement & { side: Side; counterpart: string; handle: string | null })[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("live_agent_engagements")
    .select(`${ENG_COLS}, live_agent_threads (business_name, live_agents (display_name, handle, user_id))`)
    .not("status", "in", "(replaced)").order("created_at", { ascending: false }).limit(300);
  type Row = EngagementRow & { live_agent_threads: { business_name: string; live_agents: { display_name: string; handle: string; user_id: string | null } | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const agentSide = r.live_agent_threads?.live_agents?.user_id === user.id;
    return { ...toEngagement(r), side: (agentSide ? "agent" : "business") as Side, counterpart: agentSide ? r.live_agent_threads?.business_name ?? "Business" : r.live_agent_threads?.live_agents?.display_name ?? "Live Agent", handle: r.live_agent_threads?.live_agents?.handle ?? null };
  });
}
