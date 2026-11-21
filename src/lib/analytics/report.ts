import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Admin -> Analytics data: one call to public.admin_analytics() for a date
// range (staff with analytics.view). Null when the analytics SQL hasn't been
// run yet, so the page can say so instead of failing.

export type ChannelRow = { channel: string; sessions: number; visitors: number; conversions: number; signups: number; revenue_cents: number; spend_cents: number };
export type Analytics = {
  totals: { views: number; sessions: number; visitors: number; conversions: number; signups: number; activated: number; paying: number; revenue_cents: number; spend_cents: number; bounce_sessions: number };
  channels: ChannelRow[];
  campaigns: { source: string | null; medium: string | null; campaign: string | null; sessions: number; conversions: number; signups: number }[];
  landing: { path: string; sessions: number; converted: number }[];
  referrers: { host: string; channel: string; sessions: number }[];
  pages: { path: string; views: number; sessions: number }[];
  devices: Record<string, number>;
  conversions: { name: string; count: number }[];
  ai_sources: { source: string; sessions: number; converted: number }[];
  crawlers: { bot: string; hits: number; pages: number; last_seen: string }[];
  crawled_pages: { path: string; hits: number; bots: string[] }[];
  daily: { day: string; views: number; sessions: number; conversions: number }[];
  product: {
    setup_steps: { step: number; in_progress: number; finished: number }[]; setup_status: Record<string, number>;
    lines: number; calls: number; calls_by_status: Record<string, number>; likely_scams: number; spam: number; family_alerts: number;
    active_by_month: { month: string; users: number; calls: number }[]; subscriptions: Record<string, number>;
  };
};

// [since, until] are YYYY-MM-DD in the org's time zone; until is inclusive.
export async function loadAnalytics(supabase: SupabaseClient, since: string, until: string): Promise<{ data: Analytics | null; error?: string }> {
  const end = new Date(`${until}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const { data, error } = await supabase.rpc("admin_analytics", { p_since: `${since}T00:00:00Z`, p_until: end.toISOString() });
  if (error) {
    if (/admin_analytics|does not exist|schema cache/i.test(error.message)) return { data: null, error: "setup" };
    return { data: null, error: error.message };
  }
  return { data: data as Analytics };
}

// The same length of time just before [since, until], for "vs last period".
export function previousRange(since: string, until: string) {
  const days = Math.round((Date.parse(until) - Date.parse(since)) / 86400_000) + 1;
  const d = (s: string, n: number) => { const x = new Date(`${s}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  return { since: d(since, -days), until: d(since, -1) };
}
