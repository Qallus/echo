import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhoneLookup, Prospect } from "./types";

// Redial's own prospect list (no workspace) with each number's cached lookup.
const COLS = "id, business_name, phone_e164, website, address, city, state, category, source, status, score, notes, crm_contact_id, created_at";
const LOOKUP_COLS = "phone_e164, valid, line_type, carrier_name, provider, confidence, caller_name, caller_type, error_code, cost_cents, looked_up_at";

export async function listProspects(supabase: SupabaseClient): Promise<Prospect[]> {
  const { data, error } = await supabase.from("prospects").select(COLS).is("workspace_id", null).order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<Prospect, "lookup">[];
  const lookups = await lookupsFor(supabase, rows.map((r) => r.phone_e164));
  return rows.map((r) => ({ ...r, lookup: lookups.get(r.phone_e164) ?? null }));
}

export async function lookupsFor(supabase: SupabaseClient, phones: string[]): Promise<Map<string, PhoneLookup>> {
  const out = new Map<string, PhoneLookup>();
  for (let i = 0; i < phones.length; i += 300) {
    const { data } = await supabase.from("phone_lookups").select(LOOKUP_COLS).in("phone_e164", phones.slice(i, i + 300));
    for (const l of (data ?? []) as PhoneLookup[]) out.set(l.phone_e164, l);
  }
  return out;
}
