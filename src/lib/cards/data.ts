import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_STATS, type Card, type CardLead, type CardStats } from "./types";

// Business card reads for the admin (RLS: crm.view).

export async function listCards(): Promise<Card[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("business_cards").select("*").order("full_name");
  return (data ?? []) as Card[];
}

// Event counts per card for the last `days` days.
export async function cardStats(days = 30): Promise<CardStats> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase.from("card_events").select("card_id, kind").gte("created_at", since).limit(50000);
  const stats: CardStats = {};
  for (const e of data ?? []) {
    const s = (stats[e.card_id] ??= { ...EMPTY_STATS });
    if (e.kind in s) s[e.kind as keyof typeof s] += 1;
  }
  return stats;
}

export async function listCardLeads(): Promise<CardLead[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("card_leads").select("*").order("created_at", { ascending: false }).limit(500);
  return (data ?? []) as CardLead[];
}
