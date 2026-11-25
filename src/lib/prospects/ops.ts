import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import type { Result } from "@/lib/crm/validate";
import { PROVIDERS } from "./carriers";
import { lookupsFor } from "./data";
import type { ProspectImportRow } from "./import";
import { searchPlacesText, type PlaceResult } from "./places";
import { prospectE164 } from "./phone";
import { monthSpent } from "./runner";
import { scoreProspect } from "./score";
import { loadProspecting } from "./settings";
import { scopeStamp } from "@/lib/crm/scope";

// Adding prospects (a list, or businesses found on Google Maps), shared by the
// Admin -> Prospects actions and the connector tools. The caller checks the
// permission first (crm.manage to add, prospects.run to search Google); RLS
// checks again. Each change is audited.

export const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);

export async function insertProspects(supabase: SupabaseClient, rows: ProspectImportRow[], source: "csv" | "paste" | "manual"): Promise<Result & { added?: number; duplicates?: number; invalid?: number }> {
  const ws = (await scopeStamp()).workspace_id ?? null; // this workspace's list, or staff's (null)
  if (!Array.isArray(rows) || !rows.length) return { error: "Nothing to import." };
  if (rows.length > 5000) return { error: "Import up to 5,000 numbers at a time." };
  let invalid = 0;
  const clean = new Map<string, ReturnType<typeof toRow>>();
  for (const r of rows) {
    const phone = prospectE164(String(r?.phone ?? ""));
    if (!phone) { invalid++; continue; }
    if (!clean.has(phone)) clean.set(phone, toRow(r, phone, source === "csv" || source === "manual" ? source : "paste"));
  }
  const phones = [...clean.keys()];
  // Skip numbers already on the list.
  const existing = new Set<string>();
  for (let i = 0; i < phones.length; i += 300) {
    const { data, error } = await supabase.from("prospects").select("phone_e164").filter("workspace_id", ws ? "eq" : "is", ws ?? "null").in("phone_e164", phones.slice(i, i + 300));
    if (error) return { error: error.message };
    for (const p of data ?? []) existing.add(p.phone_e164);
  }
  const fresh = phones.filter((p) => !existing.has(p)).map((p) => clean.get(p)!);
  // Numbers looked up before (for anyone) are scored right away.
  const lookups = await lookupsFor(supabase, fresh.map((r) => r.phone_e164));
  for (const r of fresh) {
    const l = lookups.get(r.phone_e164);
    r.score = scoreProspect({ provider: l?.provider ?? null, confidence: l?.confidence ?? null, category: r.category, city: r.city, website: r.website, status: "new" });
  }
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase.from("prospects").insert(fresh.slice(i, i + 500).map((r) => ({ ...r, ...(ws ? { workspace_id: ws } : {}) })));
    if (error) return { error: error.message };
  }
  await adminAudit(supabase, "prospects.import", undefined, { added: fresh.length, duplicates: existing.size, invalid, source });
  const parts = [`${fresh.length} added`, existing.size ? `${existing.size} already on the list` : "", invalid ? `${invalid} not valid numbers` : ""].filter(Boolean);
  return { ok: `${parts.join(", ")}.`, added: fresh.length, duplicates: existing.size, invalid };
}

function toRow(r: ProspectImportRow, phone: string, source: "csv" | "paste" | "manual") {
  return { phone_e164: phone, source, ...details(r), score: 0 as number };
}

// The editable details, cleaned. Newer columns are only included when given,
// so imports still work on a database without migration 20261122110000.
export function details(r: Partial<ProspectImportRow>) {
  const ext = clip(r.phone_ext, 8);
  const count = Number(clip(r.locations, 6) ?? "");
  const mail = clip(r.email, 200)?.toLowerCase() ?? null;
  const extra = {
    contact_first_name: clip(r.contact_first_name, 100), contact_last_name: clip(r.contact_last_name, 100), contact_title: clip(r.contact_title, 120),
    email: mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? mail : null, phone_ext: ext && /^[0-9]{1,8}$/.test(ext) ? ext : null,
    address2: clip(r.address2, 100), zip: clip(r.zip, 20), country: clip(r.country, 60),
    locations: Number.isInteger(count) && count >= 1 && count <= 100000 ? count : null,
    tags: [...new Set((r.tags ?? "").split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20),
    provider_override: providerKey(r.provider_override),
    provider_note: clip(r.provider_note, 300),
  };
  return {
    business_name: clip(r.business_name, 200), website: clip(r.website, 300), address: clip(r.address, 300),
    city: clip(r.city, 100), state: clip(r.state, 60), category: clip(r.category, 100), notes: clip(r.notes, 5000),
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length))),
  };
}

// "RingCentral", "ringcentral" or "Cox Business" -> the provider key.
function providerKey(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!t) return null;
  const k = (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).find((x) => x !== "unknown" && (x === t || PROVIDERS[x].label.toLowerCase() === t || t.includes(x.replace("_", " "))));
  return k ?? null;
}

// ---------------------------------------------------------------------------
// Google Places: find businesses by category and city (each page of results
// costs money and counts against the monthly cap), then add the chosen ones.
// ---------------------------------------------------------------------------
export type FoundPlace = PlaceResult & { onList: boolean };
export type PlacesPage = { results?: FoundPlace[]; next?: string; error?: string; costCents?: number; spentCents?: number; capCents?: number };

const SETUP = "Run supabase/migrations/20261123130000_prospects_places.sql in Supabase first.";

export async function findPlacesFor(supabase: SupabaseClient, query: string, pageToken?: string, page = 1): Promise<PlacesPage> {
  const ws = (await scopeStamp()).workspace_id ?? null; // this workspace's list, or staff's (null)
  const q = typeof query === "string" ? query.trim().replace(/\s+/g, " ").slice(0, 200) : "";
  if (q.length < 3) return { error: "Type what and where, like \"HVAC in Chandler, AZ\"." };
  const n = Math.min(Math.max(Math.round(Number(page) || 1), 1), 3);
  const { error: missing } = await supabase.from("places_searches").select("id").limit(1);
  if (missing) return { error: SETUP };
  const settings = await loadProspecting(supabase);
  const spent = await monthSpent(supabase);
  const cost = settings.placesPageCents;
  if (spent + cost > settings.monthlyCapCents) return { error: `That would pass this month's cap ($${(settings.monthlyCapCents / 100).toFixed(2)}). Raise it in Settings.`, spentCents: spent, capCents: settings.monthlyCapCents };
  const found = await searchPlacesText(q, typeof pageToken === "string" && pageToken ? pageToken.slice(0, 2000) : undefined);
  if (found.error) return { error: found.error };
  const results = found.results ?? [];
  await supabase.from("places_searches").insert({ query: q, page: n, results: results.length, cost_cents: cost });
  await adminAudit(supabase, "prospects.places.search", undefined, { query: q, page: n, results: results.length, cost_cents: cost });
  // Mark what's already on the list (same phone number or same place).
  const phones = results.map((r) => r.phoneE164).filter((p): p is string => Boolean(p));
  const ids = results.map((r) => r.placeId);
  const [byPhone, byPlace] = await Promise.all([
    phones.length ? supabase.from("prospects").select("phone_e164").filter("workspace_id", ws ? "eq" : "is", ws ?? "null").in("phone_e164", phones) : null,
    ids.length ? supabase.from("prospects").select("source_ref").filter("workspace_id", ws ? "eq" : "is", ws ?? "null").eq("source", "places").in("source_ref", ids) : null,
  ]);
  const have = new Set([...(byPhone?.data ?? []).map((p) => p.phone_e164 as string), ...(byPlace?.data ?? []).map((p) => p.source_ref as string)]);
  return {
    results: results.map((r) => ({ ...r, onList: have.has(r.placeId) || (r.phoneE164 ? have.has(r.phoneE164) : false) })),
    next: n < 3 ? found.next : undefined, costCents: cost, spentCents: spent + cost, capCents: settings.monthlyCapCents,
  };
}

export async function insertPlaces(supabase: SupabaseClient, places: PlaceResult[], tags?: string): Promise<Result & { added?: number }> {
  const ws = (await scopeStamp()).workspace_id ?? null; // this workspace's list, or staff's (null)
  if (!Array.isArray(places) || !places.length) return { error: "Pick at least one business." };
  if (places.length > 200) return { error: "Add up to 200 at a time." };
  const now = new Date().toISOString();
  const clean = new Map<string, Record<string, unknown>>();
  let noPhone = 0;
  for (const p of places) {
    const phone = prospectE164(String(p?.phoneE164 ?? p?.phone ?? ""));
    if (!phone) { noPhone++; continue; }
    if (clean.has(phone)) continue;
    const at = typeof p.lat === "number" && typeof p.lng === "number" && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
    const rating = typeof p.rating === "number" && p.rating >= 0 && p.rating <= 5 ? Math.round(p.rating * 10) / 10 : null;
    const reviews = typeof p.reviews === "number" && p.reviews >= 0 ? Math.round(p.reviews) : null;
    clean.set(phone, {
      phone_e164: phone, source: "places", source_ref: clip(p.placeId, 300), score: 0,
      ...details({ business_name: p.name, website: p.website ?? undefined, address: p.address ?? undefined, address2: p.address2 ?? undefined,
        city: p.city ?? undefined, state: p.state ?? undefined, zip: p.zip ?? undefined, country: p.country ?? undefined, category: p.category ?? undefined, tags }),
      ...(at ? { latitude: p.lat, longitude: p.lng, geocoded_at: now } : {}),
      ...(rating !== null ? { rating } : {}), ...(reviews !== null ? { review_count: reviews } : {}),
    });
  }
  const phones = [...clean.keys()];
  const existing = new Set<string>();
  if (phones.length) {
    const { data, error } = await supabase.from("prospects").select("phone_e164").filter("workspace_id", ws ? "eq" : "is", ws ?? "null").in("phone_e164", phones);
    if (error) return { error: error.message };
    for (const p of data ?? []) existing.add(p.phone_e164 as string);
  }
  const fresh = phones.filter((p) => !existing.has(p)).map((p) => clean.get(p)!);
  const lookups = await lookupsFor(supabase, fresh.map((r) => r.phone_e164 as string));
  for (const r of fresh) {
    const l = lookups.get(r.phone_e164 as string);
    r.score = scoreProspect({ provider: l?.provider ?? null, confidence: l?.confidence ?? null, category: (r.category as string) ?? null, city: (r.city as string) ?? null, website: (r.website as string) ?? null, status: "new" });
  }
  if (fresh.length) {
    const { error } = await supabase.from("prospects").insert(fresh.map((r) => ({ ...r, ...(ws ? { workspace_id: ws } : {}) })));
    if (error) return { error: /column|schema cache/i.test(error.message) ? SETUP : error.message };
  }
  await adminAudit(supabase, "prospects.import", undefined, { added: fresh.length, duplicates: existing.size, invalid: noPhone, source: "places" });
  const parts = [`${fresh.length} added`, existing.size ? `${existing.size} already on the list` : "", noPhone ? `${noPhone} had no phone number` : ""].filter(Boolean);
  return { ok: `${parts.join(", ")}.`, added: fresh.length };
}
