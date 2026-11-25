import "server-only";
import { listWorkspaces } from "@/lib/data";
import { agentsByIds } from "./data";
import { myEngagements } from "./messages";
import { engagementLabel, offerPrice } from "./types";

// Who works with whom: the Live Agents a business has hired (My Live Agents)
// and the businesses a Live Agent works for (Agent Desk → My clients). One
// row per agent (or business), with its latest work and the conversation.

export type Standing = "working" | "booked" | "offer" | "past";
const RANK: Record<Standing, number> = { working: 0, booked: 1, offer: 2, past: 3 };
const standing = (status: string): Standing =>
  status === "active" ? "working" : status === "accepted" ? "booked" : status === "offered" ? "offer" : "past";

export type HiredAgent = {
  id: string; threadId: string; workspace: string; name: string; handle: string | null; headline: string; avatarUrl: string | null;
  city: string; region: string; lat: number | null; lng: number | null; skills: string[]; languages: string[]; rating: number | null;
  availableNow: boolean; standing: Standing; work: string; rate: string; startsOn: string | null; since: string; jobs: number;
};

export async function myHiredAgents(): Promise<HiredAgent[]> {
  const [all, workspaces] = await Promise.all([myEngagements(), listWorkspaces()]);
  const mine = all.filter((e) => e.side === "business");
  const profiles = new Map((await agentsByIds([...new Set(mine.map((e) => e.agentId))])).map((a) => [a.id, a]));
  const wsName = (id: string) => { const w = workspaces.find((x) => x.id === id); return w ? (w.isPersonal ? "Personal" : w.name) : ""; };
  const byAgent = new Map<string, typeof mine>();
  for (const e of mine) byAgent.set(`${e.workspaceId}|${e.agentId}`, [...(byAgent.get(`${e.workspaceId}|${e.agentId}`) ?? []), e]);
  return [...byAgent.values()].map((list) => {
    const best = [...list].sort((a, b) => RANK[standing(a.status)] - RANK[standing(b.status)] || b.createdAt.localeCompare(a.createdAt))[0];
    const p = profiles.get(best.agentId);
    return {
      id: `${best.workspaceId}|${best.agentId}`, threadId: best.threadId, workspace: wsName(best.workspaceId),
      name: p?.displayName ?? best.counterpart, handle: p?.handle ?? best.handle, headline: p?.headline ?? "", avatarUrl: p?.avatarUrl ?? null,
      city: p?.city ?? "", region: p?.region ?? "", lat: p?.lat ?? null, lng: p?.lng ?? null, skills: p?.skills ?? [], languages: p?.languages ?? [],
      rating: p?.rating ?? null, availableNow: p?.availableNow ?? false,
      standing: standing(best.status), work: engagementLabel(best.type), rate: offerPrice(best).businessRate,
      startsOn: best.startsOn, since: list.map((e) => e.createdAt).sort()[0], jobs: list.filter((e) => ["active", "accepted", "completed"].includes(e.status)).length,
    };
  });
}

export type MyClient = { id: string; threadId: string; name: string; standing: Standing; work: string; rate: string; startsOn: string | null; since: string; jobs: number };

export async function myClients(): Promise<MyClient[]> {
  const mine = (await myEngagements()).filter((e) => e.side === "agent");
  const byThread = new Map<string, typeof mine>();
  for (const e of mine) byThread.set(e.threadId, [...(byThread.get(e.threadId) ?? []), e]);
  return [...byThread.values()].map((list) => {
    const best = [...list].sort((a, b) => RANK[standing(a.status)] - RANK[standing(b.status)] || b.createdAt.localeCompare(a.createdAt))[0];
    return {
      id: best.threadId, threadId: best.threadId, name: best.counterpart, standing: standing(best.status), work: engagementLabel(best.type),
      rate: offerPrice(best).agentRate, startsOn: best.startsOn, since: list.map((e) => e.createdAt).sort()[0],
      jobs: list.filter((e) => ["active", "accepted", "completed"].includes(e.status)).length,
    };
  });
}
