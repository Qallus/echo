"use server";

import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { loadWebSearch, readWebSearch, searchMonthSpent, searchReady, webSearch, type SearchOutcome, type SearchProvider, type WebSearchSettings } from "@/lib/research/search";
import { createClient } from "@/lib/supabase/server";

// Admin -> Settings -> Integrations -> Web search: which providers are set
// up, the default, prices and monthly cap, and a test search.

const SETUP = "Run supabase/migrations/20261124100000_web_search.sql in Supabase first.";

export async function webSearchStatus(): Promise<{ settings: WebSearchSettings; ready: Record<SearchProvider, boolean>; spentCents: number | null }> {
  await requireStaff("audit.view");
  const supabase = await createClient();
  const [settings, ready] = await Promise.all([loadWebSearch(supabase), searchReady()]);
  const { error } = await supabase.from("web_searches").select("id").limit(1);
  return { settings, ready, spentCents: error ? null : await searchMonthSpent(supabase) };
}

export async function saveWebSearchSettings(input: WebSearchSettings): Promise<{ ok?: string; error?: string }> {
  await requireStaff("settings.manage");
  const value = readWebSearch(input);
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "web_search", value });
  if (error) return { error: /row-level security/i.test(error.message) ? SETUP : error.message };
  await adminAudit(supabase, "settings.web_search.save", { type: "setting", id: "web_search" }, value);
  return { ok: "Saved." };
}

export async function testWebSearch(query: string, provider: SearchProvider): Promise<{ result?: SearchOutcome; error?: string }> {
  await requireStaff("crm.view");
  const supabase = await createClient();
  try {
    return { result: await webSearch(supabase, { query, provider, count: 5 }) };
  } catch (e) {
    const m = e instanceof Error ? e.message : "Search failed.";
    return { error: /web_searches|schema cache|does not exist/i.test(m) ? SETUP : m };
  }
}
