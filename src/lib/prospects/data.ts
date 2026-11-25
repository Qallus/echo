import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveProvider } from "./carriers";
import { scoreProspect } from "./score";
import type { PhoneLookup, Prospect } from "./types";
import { scopeStamp } from "@/lib/crm/scope";

// Redial's own prospect list (no workspace) with each number's cached lookup.
const COLS = "id, business_name, phone_e164, website, address, city, state, category, source, status, score, notes, crm_contact_id, created_at";
// Added later (migrations 20261122100000 and 20261122110000).
const EXTRA = "latitude, longitude, contact_first_name, contact_last_name, contact_title, email, phone_ext, address2, zip, country, locations, tags, provider_override, provider_note";
const LOOKUP_COLS = "phone_e164, valid, line_type, carrier_name, provider, confidence, caller_name, caller_type, error_code, cost_cents, looked_up_at";

export async function listProspects(supabase: SupabaseClient): Promise<Prospect[]> {
  const ws = (await scopeStamp()).workspace_id ?? null; // this workspace's list, or staff's (null)
  const query = (cols: string) => supabase.from("prospects").select(cols).filter("workspace_id", ws ? "eq" : "is", ws ?? "null").order("created_at", { ascending: false }).limit(5000);
  let { data, error } = await query(`${COLS}, ${EXTRA}, rating, review_count`);
  // Newer columns not added yet: list without them.
  if (error && /does not exist|schema cache/i.test(error.message)) ({ data, error } = await query(`${COLS}, ${EXTRA}`));
  // Newer columns not added yet: list without them.
  if (error && /does not exist|schema cache/i.test(error.message)) ({ data, error } = await query(`${COLS}, ${EXTRA.replace(", provider_override, provider_note", "")}`));
  if (error && /does not exist|schema cache/i.test(error.message)) ({ data, error } = await query(COLS));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Omit<Prospect, "lookup" | "provider" | "confidence" | "providerByYou">[];
  const lookups = await lookupsFor(supabase, rows.map((r) => r.phone_e164));
  return rows.map((r) => {
    const lookup = lookups.get(r.phone_e164) ?? null;
    const e = effectiveProvider(lookup, r.provider_override);
    // Scored on read, so edits to the carrier rules or weights apply everywhere.
    const score = scoreProspect({ provider: e.provider, confidence: e.confidence, category: r.category, city: r.city, website: r.website, status: r.status });
    return { ...r, score, lookup, provider: e.provider, confidence: e.confidence, providerByYou: e.byYou };
  });
}

export async function lookupsFor(supabase: SupabaseClient, phones: string[]): Promise<Map<string, PhoneLookup>> {
  const out = new Map<string, PhoneLookup>();
  for (let i = 0; i < phones.length; i += 300) {
    const { data } = await supabase.from("phone_lookups").select(LOOKUP_COLS).in("phone_e164", phones.slice(i, i + 300));
    for (const l of (data ?? []) as PhoneLookup[]) out.set(l.phone_e164, l);
  }
  return out;
}
