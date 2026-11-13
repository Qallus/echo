import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { toAgent, type Row, type SampleRow } from "./data";
import type { LiveAgent } from "./types";

// The signed-in person's own Live Agent profile, in any status (RLS: owners
// see their own row and all of its clips, including pending ones).

export type VoiceClipStatus = "pending" | "approved" | "rejected";
export type MyLiveAgent = LiveAgent & {
  status: "draft" | "pending" | "live" | "paused" | "suspended";
  setupStep: number;
  reviewNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  avatarPath: string | null;
  clipStatus: Record<string, VoiceClipStatus>;
};

const COLS = `id, handle, display_name, headline, bio, city, region, time_zone, geo_lat, geo_lng, years_experience, languages, industries, skills, equipment, workspace,
  experience, per_minute_cents, hourly_cents, retainer_cents, retainer_hours, availability, available_now, avatar_url, is_demo, indexable,
  rating, review_count, engagement_count, reply_minutes, badges, created_at, status, setup_step, review_note, submitted_at, approved_at,
  live_agent_voice_samples (id, title, transcript, storage_path, duration_s, featured, ai_voice, sort, status)`;

type MyRow = Row & { status: MyLiveAgent["status"]; setup_step: number; review_note: string | null; submitted_at: string | null; approved_at: string | null };

export const myLiveAgent = cache(async (): Promise<MyLiveAgent | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_agents").select(COLS).eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as MyRow;
  return {
    ...toAgent(r),
    status: r.status, setupStep: r.setup_step, reviewNote: r.review_note, submittedAt: r.submitted_at, approvedAt: r.approved_at,
    avatarPath: r.avatar_url,
    clipStatus: Object.fromEntries((r.live_agent_voice_samples ?? []).map((s: SampleRow) => [s.id, (s.status ?? "pending") as VoiceClipStatus])),
  };
});

// For the sidebar: does the signed-in person have a Live Agent profile?
export const hasLiveAgentProfile = cache(async (): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { count } = await supabase.from("live_agents").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return Boolean(count);
});

// What's still missing before a profile can be sent for review.
export function profileGaps(a: LiveAgent): { step: number; label: string }[] {
  const gaps: { step: number; label: string }[] = [];
  if (!a.avatarUrl) gaps.push({ step: 2, label: "Add a profile photo" });
  if (!a.bio || a.bio.length < 40) gaps.push({ step: 3, label: "Write a short bio (40+ characters)" });
  if (a.skills.length < 2) gaps.push({ step: 4, label: "Pick at least 2 skills" });
  if (!a.equipment.length || !a.workspace.length) gaps.push({ step: 5, label: "Describe your workspace and equipment" });
  if (!a.samples.length) gaps.push({ step: 6, label: "Record at least 1 voice clip" });
  if (a.perMinuteCents == null && a.hourlyCents == null) gaps.push({ step: 7, label: "Set a per-minute or hourly rate" });
  if (!Object.keys(a.availability).length) gaps.push({ step: 7, label: "Set your weekly hours" });
  return gaps;
}

// 0–100: how complete the profile looks to a business.
export function profileStrength(a: LiveAgent): number {
  const checks = [
    Boolean(a.avatarUrl), Boolean(a.bio && a.bio.length >= 40), a.experience.length > 0, a.industries.length > 0, a.skills.length >= 2,
    a.languages.length > 0, a.equipment.length >= 2, a.workspace.length >= 1, a.samples.length >= 1, a.samples.length >= 2, a.samples.length >= 3,
    a.perMinuteCents != null || a.hourlyCents != null, Object.keys(a.availability).length > 0, a.yearsExperience > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
