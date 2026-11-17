import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaUrl } from "./data";
import type { AdminAgent } from "./admin-types";

// Staff management of Live Agents, shared by the admin page (server actions)
// and the Claude connector. The database functions check marketplace.view /
// marketplace.manage again; callers write the audit log.

type Row = {
  id: string; user_id: string | null; email: string | null; phone: string | null; handle: string; display_name: string; headline: string; bio: string | null;
  city: string; region: string; time_zone: string; geo_lat: number | string | null; geo_lng: number | string | null; years_experience: number; languages: string[];
  industries: string[]; skills: string[]; equipment: string[]; workspace: string[]; experience: { title: string; detail?: string }[];
  per_minute_cents: number | null; hourly_cents: number | null; retainer_cents: number | null; retainer_hours: number | null;
  availability: Record<string, [string, string]>; available_now: boolean; avatar_url: string | null; status: string; is_demo: boolean;
  rating: number | string | null; review_count: number; engagement_count: number; review_note: string | null;
  submitted_at: string | null; approved_at: string | null; created_at: string; updated_at: string;
  samples: { id: string; title: string; transcript: string | null; storage_path: string; duration_s: number | null; status: string; ai_voice: boolean }[];
};

const num = (v: number | string | null) => (v == null ? null : Number(v));

export async function listAdminAgents(supabase: SupabaseClient): Promise<{ agents: AdminAgent[]; error?: string }> {
  const { data, error } = await supabase.rpc("admin_live_agents");
  if (error) return { agents: [], error: error.message };
  return {
    agents: ((data ?? []) as Row[]).map((r) => ({
      id: r.id, userId: r.user_id, email: r.email, phone: r.phone, handle: r.handle, name: r.display_name, headline: r.headline, bio: r.bio,
      city: r.city, region: r.region, timeZone: r.time_zone, lat: num(r.geo_lat), lng: num(r.geo_lng), years: r.years_experience,
      languages: r.languages ?? [], industries: r.industries ?? [], skills: r.skills ?? [], equipment: r.equipment ?? [], workspace: r.workspace ?? [],
      experience: r.experience ?? [], perMinuteCents: r.per_minute_cents, hourlyCents: r.hourly_cents, retainerCents: r.retainer_cents, retainerHours: r.retainer_hours,
      availability: r.availability ?? {}, availableNow: r.available_now, avatarUrl: r.avatar_url ? mediaUrl(r.avatar_url) : null,
      status: r.status, isDemo: r.is_demo, rating: num(r.rating), reviewCount: r.review_count ?? 0, engagementCount: r.engagement_count ?? 0,
      reviewNote: r.review_note, submittedAt: r.submitted_at, approvedAt: r.approved_at, createdAt: r.created_at, updatedAt: r.updated_at,
      samples: (r.samples ?? []).map((s) => ({ id: s.id, title: s.title, transcript: s.transcript, url: mediaUrl(s.storage_path), durationS: s.duration_s, status: s.status, aiVoice: s.ai_voice })),
    })),
  };
}

export const BULK_DECISIONS = ["approve", "suspend", "restore", "archive", "unarchive"] as const;
export type BulkDecision = (typeof BULK_DECISIONS)[number];

// Apply one decision to many profiles. Returns what changed and what didn't.
export async function decideMany(supabase: SupabaseClient, ids: string[], decision: BulkDecision, note?: string) {
  const done: string[] = [];
  const errors: string[] = [];
  for (const target of ids) {
    const { error } = await supabase.rpc("review_live_agent", { target, decision, note: note?.trim().slice(0, 1000) || null });
    if (error) errors.push(error.code === "42501" ? "You can't manage Live Agents." : error.message);
    else done.push(target);
  }
  return { done, errors: [...new Set(errors)] };
}

export async function deleteMany(supabase: SupabaseClient, ids: string[]) {
  const done: { id: string; name: string }[] = [];
  const errors: string[] = [];
  for (const target of ids) {
    const { data, error } = await supabase.rpc("admin_delete_live_agent", { target });
    if (error) errors.push(error.code === "42501" ? "You can't manage Live Agents." : error.message);
    else done.push({ id: target, name: String(data) });
  }
  return { done, errors };
}

export type AgentPatch = Partial<{
  display_name: string; headline: string; bio: string; city: string; region: string; time_zone: string; years_experience: number;
  languages: string[]; hourly_cents: number | null; per_minute_cents: number | null; retainer_cents: number | null; retainer_hours: number | null; review_note: string;
}>;

// Checks the same limits as the table, so the error is readable.
export function cleanPatch(p: AgentPatch): AgentPatch | { error: string } {
  const out: AgentPatch = {};
  const str = (k: keyof AgentPatch, min: number, max: number, label: string) => {
    const v = p[k];
    if (v === undefined) return null;
    const s = String(v).trim();
    if (s.length < min || s.length > max) return `${label} must be ${min ? `${min}–` : "up to "}${max} characters.`;
    (out as Record<string, unknown>)[k] = s;
    return null;
  };
  const cents = (k: "hourly_cents" | "per_minute_cents" | "retainer_cents", lo: number, hi: number, label: string) => {
    const v = p[k];
    if (v === undefined) return null;
    if (v === null) { out[k] = null; return null; }
    if (!Number.isInteger(v) || v < lo || v > hi) return `${label} must be between $${lo / 100} and $${hi / 100}.`;
    out[k] = v;
    return null;
  };
  const problems = [
    str("display_name", 2, 40, "Name"), str("headline", 4, 90, "Headline"), str("bio", 0, 600, "Bio"),
    str("city", 1, 60, "City"), str("region", 1, 30, "State"), str("time_zone", 1, 40, "Time zone"), str("review_note", 0, 1000, "Note"),
    cents("hourly_cents", 1000, 20000, "Hourly rate"), cents("per_minute_cents", 10, 1000, "Per-minute rate"), cents("retainer_cents", 10000, 2000000, "Monthly plan"),
  ];
  if (p.years_experience !== undefined) {
    if (!Number.isInteger(p.years_experience) || p.years_experience < 0 || p.years_experience > 60) problems.push("Years of experience must be 0–60.");
    else out.years_experience = p.years_experience;
  }
  if (p.retainer_hours !== undefined) {
    if (p.retainer_hours !== null && (!Number.isInteger(p.retainer_hours) || p.retainer_hours < 5 || p.retainer_hours > 200)) problems.push("Monthly plan hours must be 5–200.");
    else out.retainer_hours = p.retainer_hours;
  }
  if (p.languages !== undefined) {
    const langs = [...new Set(p.languages.map((l) => l.trim()).filter(Boolean))].slice(0, 8);
    if (!langs.length) problems.push("Add at least one language.");
    else out.languages = langs;
  }
  const first = problems.find(Boolean);
  if (first) return { error: first };
  if (!Object.keys(out).length) return { error: "Nothing to change." };
  return out;
}

export async function updateAgent(supabase: SupabaseClient, id: string, patch: AgentPatch) {
  const clean = cleanPatch(patch);
  if ("error" in clean) return { error: clean.error as string };
  const { error } = await supabase.rpc("admin_update_live_agent", { target: id, patch: clean });
  if (error) return { error: error.code === "42501" ? "You can't manage Live Agents." : error.code === "P0002" ? "Profile not found." : "Couldn't save that. Check the values and try again." };
  return { ok: Object.keys(clean) };
}

export async function notifyAgents(supabase: SupabaseClient, ids: string[], title: string, body: string) {
  const { data, error } = await supabase.rpc("admin_live_agent_notify", { targets: ids, title: title.trim(), body: body.trim() });
  if (error) return { error: error.code === "42501" ? "You can't manage Live Agents." : error.message };
  return { sent: Number(data ?? 0) };
}
