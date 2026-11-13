import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_FEES, RATE_RANGES, type Fees, type Filters, type LiveAgent, type Skill, type VoiceSample, type Weekday } from "./types";

// Reads for the public Live Agents pages. They run with the visitor's client
// (anonymous or signed in), so RLS shows only live profiles and approved
// voice clips. The catalog is small, so search and filters run here.

const COLS = `id, handle, display_name, headline, bio, city, region, time_zone, geo_lat, geo_lng, years_experience, languages, industries, skills,
  experience, per_minute_cents, hourly_cents, retainer_cents, retainer_hours, availability, available_now, avatar_url, is_demo, indexable,
  rating, review_count, engagement_count, reply_minutes, badges, created_at,
  live_agent_voice_samples (id, title, transcript, storage_path, duration_s, featured, ai_voice, sort)`;

type SampleRow = { id: string; title: string; transcript: string | null; storage_path: string; duration_s: number | null; featured: boolean; ai_voice: boolean; sort: number };
type Row = {
  id: string; handle: string; display_name: string; headline: string; bio: string | null; city: string; region: string; time_zone: string;
  geo_lat: number | null; geo_lng: number | null; years_experience: number; languages: string[]; industries: string[]; skills: string[];
  experience: { title: string; detail?: string }[]; per_minute_cents: number | null; hourly_cents: number | null; retainer_cents: number | null;
  retainer_hours: number | null; availability: Partial<Record<Weekday, [string, string]>>; available_now: boolean; avatar_url: string | null;
  is_demo: boolean; indexable: boolean; rating: number | null; review_count: number; engagement_count: number; reply_minutes: number | null;
  badges: string[]; created_at: string; live_agent_voice_samples: SampleRow[] | null;
};

// Demo clips ship with the site (/live-agents/demo/...); real ones are in
// the public live-agent-media bucket.
const mediaUrl = (path: string) =>
  path.startsWith("/") ? path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/live-agent-media/${path}`;

function toAgent(r: Row): LiveAgent {
  const samples: VoiceSample[] = (r.live_agent_voice_samples ?? [])
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort)
    .map((s) => ({ id: s.id, title: s.title, transcript: s.transcript, url: mediaUrl(s.storage_path), durationS: s.duration_s == null ? null : Number(s.duration_s), featured: s.featured, aiVoice: s.ai_voice }));
  return {
    id: r.id, handle: r.handle, displayName: r.display_name, headline: r.headline, bio: r.bio, city: r.city, region: r.region, timeZone: r.time_zone,
    lat: r.geo_lat == null ? null : Number(r.geo_lat), lng: r.geo_lng == null ? null : Number(r.geo_lng),
    yearsExperience: r.years_experience, languages: r.languages, industries: r.industries, skills: r.skills,
    experience: Array.isArray(r.experience) ? r.experience : [],
    perMinuteCents: r.per_minute_cents, hourlyCents: r.hourly_cents, retainerCents: r.retainer_cents, retainerHours: r.retainer_hours,
    availability: r.availability ?? {}, availableNow: r.available_now, avatarUrl: r.avatar_url ? mediaUrl(r.avatar_url) : null,
    isDemo: r.is_demo, indexable: r.indexable && !r.is_demo, rating: r.rating == null ? null : Number(r.rating), reviewCount: r.review_count,
    engagementCount: r.engagement_count, replyMinutes: r.reply_minutes, badges: r.badges, samples,
  };
}

// All live profiles (null when the tables aren't set up yet).
const allLive = cache(async (): Promise<LiveAgent[] | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_agents").select(COLS).eq("status", "live").limit(500);
  if (error) return null;
  return (data as unknown as Row[]).map(toAgent);
});

export const listSkills = cache(async (): Promise<Skill[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("live_agent_skills").select("slug, label, icon, category").order("sort");
  return (data ?? []) as Skill[];
});

export const getFees = cache(async (): Promise<Fees> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("live_agent_fees");
  if (error || !data) return DEFAULT_FEES;
  const v = data as Partial<Fees>;
  const pct = (x: unknown, d: number) => (typeof x === "number" && x >= 0 && x <= 50 ? x : d);
  return { businessFeePercent: pct(v.businessFeePercent, DEFAULT_FEES.businessFeePercent), agentFeePercent: pct(v.agentFeePercent, DEFAULT_FEES.agentFeePercent) };
});

// Higher is better: available now, covers more skills asked for, replies
// fast, experienced, rated well (once reviews exist).
function score(a: LiveAgent) {
  return (a.availableNow ? 30 : 0) + Math.min(a.yearsExperience, 15) + (a.replyMinutes == null ? 0 : Math.max(0, 20 - a.replyMinutes / 6)) + (a.rating ?? 0) * 4;
}

export async function listLiveAgents(f: Filters, skills: Skill[]): Promise<{ ready: boolean; agents: LiveAgent[]; total: number }> {
  const all = await allLive();
  if (!all) return { ready: false, agents: [], total: 0 };
  const label = new Map(skills.map((s) => [s.slug, s.label.toLowerCase()]));
  const q = f.q.toLowerCase();
  const range = RATE_RANGES.find((r) => r.id === f.rate);
  const agents = all.filter((a) => {
    if (f.now && !a.availableNow) return false;
    if (f.skill && !a.skills.includes(f.skill)) return false;
    if (f.language && !a.languages.includes(f.language)) return false;
    if (range && range.id !== "any") {
      const h = a.hourlyCents ?? 0;
      if ("min" in range && h < range.min) return false;
      if ("max" in range && h >= range.max) return false;
    }
    if (q) {
      const hay = [a.displayName, a.headline, a.bio ?? "", a.city, a.region, ...a.languages, ...a.industries, ...a.skills.map((s) => label.get(s) ?? s)].join(" ").toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const by: Record<Filters["sort"], (a: LiveAgent, b: LiveAgent) => number> = {
    best: (a, b) => score(b) - score(a),
    price: (a, b) => (a.hourlyCents ?? 1e9) - (b.hourlyCents ?? 1e9),
    experience: (a, b) => b.yearsExperience - a.yearsExperience,
    replies: (a, b) => (a.replyMinutes ?? 1e9) - (b.replyMinutes ?? 1e9),
  };
  agents.sort((a, b) => by[f.sort](a, b) || a.displayName.localeCompare(b.displayName));
  return { ready: true, agents, total: all.length };
}

export async function liveAgentStats() {
  const all = (await allLive()) ?? [];
  return {
    total: all.length,
    availableNow: all.filter((a) => a.availableNow).length,
    languages: [...new Set(all.flatMap((a) => a.languages))].sort(),
  };
}

export async function getLiveAgent(handle: string): Promise<LiveAgent | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(handle)) return null;
  const all = await allLive();
  return all?.find((a) => a.handle === handle) ?? null;
}
