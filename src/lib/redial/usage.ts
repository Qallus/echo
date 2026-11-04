import type { SupabaseClient } from "@supabase/supabase-js";

// Redial screening minutes this month (public.redial_usage): each call's AI
// time rounds up to whole minutes; the allowance is the Redial plan's minutes
// (or the free minutes) plus unused pack minutes. At the limit, unknown
// callers go to voicemail instead of the AI.

export type RedialUsage = {
  used_minutes: number; used_seconds: number; plan_minutes: number; free: boolean; pack_minutes: number;
  allowance: number; remaining_seconds: number; period_start: string;
};

export async function redialUsage(db: SupabaseClient, userId: string): Promise<RedialUsage | null> {
  const { data, error } = await db.rpc("redial_usage", { p_user: userId });
  if (error) { console.error("[redial usage]", error.message); return null; }
  return data as RedialUsage;
}

// Below this, a new call isn't worth starting with the AI.
export const MIN_SECONDS_TO_SCREEN = 30;
