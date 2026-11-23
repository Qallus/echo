import type { SupabaseClient } from "@supabase/supabase-js";

// Prospecting settings (platform_settings "prospecting"), edited on
// Admin -> Prospects -> Settings. Twilio bills Line Type Intelligence and
// Caller Name per lookup, separately: check the current prices in the Twilio
// console and enter them here. Amounts are US cents.

export type ProspectingSettings = {
  lineTypeCents: number; // per number, Line Type Intelligence
  callerNameCents: number; // per number, Caller Name (CNAM), only when ticked
  monthlyCapCents: number; // no run may push this month's spend past this
  cacheDays: number; // a number isn't looked up again within this many days
  placesPageCents: number; // per page of Google Places results (up to 20 businesses)
};

export const DEFAULT_PROSPECTING: ProspectingSettings = { lineTypeCents: 0.8, callerNameCents: 1, monthlyCapCents: 2500, cacheDays: 90, placesPageCents: 3.5 };

const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;

export function readProspecting(value: unknown): ProspectingSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ProspectingSettings, unknown>>;
  const d = DEFAULT_PROSPECTING;
  return {
    lineTypeCents: num(v.lineTypeCents, 0, 100, d.lineTypeCents),
    callerNameCents: num(v.callerNameCents, 0, 100, d.callerNameCents),
    monthlyCapCents: num(v.monthlyCapCents, 0, 10_000_000, d.monthlyCapCents),
    cacheDays: Math.round(num(v.cacheDays, 1, 730, d.cacheDays)),
    placesPageCents: num(v.placesPageCents, 0, 100, d.placesPageCents),
  };
}

export async function loadProspecting(supabase: SupabaseClient): Promise<ProspectingSettings> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "prospecting").maybeSingle();
  return readProspecting(data?.value);
}

// Cost of looking up `count` numbers, in cents.
export const lookupCost = (s: ProspectingSettings, count: number, callerName: boolean) =>
  count * (s.lineTypeCents + (callerName ? s.callerNameCents : 0));
