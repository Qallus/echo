import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Billing settings from Super Admin (platform_settings "billing").
export type BillingSettings = {
  freeMinutes: number; // monthly minutes without a plan
  byokDiscountPercent: number; // off subscriptions for customers using their own AI keys (0 = off)
  enforceLimits: boolean; // block new transcriptions past the allowance (off for now: usage is shown only)
  redialFreeMinutes: number; // Redial screening minutes a month without a Redial plan (always enforced)
};

export const DEFAULT_BILLING: BillingSettings = { freeMinutes: 300, byokDiscountPercent: 20, enforceLimits: false, redialFreeMinutes: 10 };

export function parseBillingSettings(value: unknown): BillingSettings {
  const v = (value ?? {}) as Partial<BillingSettings>;
  const num = (x: unknown, d: number, max: number) => (typeof x === "number" && x >= 0 && x <= max ? Math.round(x) : d);
  return {
    freeMinutes: num(v.freeMinutes, DEFAULT_BILLING.freeMinutes, 1_000_000),
    byokDiscountPercent: num(v.byokDiscountPercent, DEFAULT_BILLING.byokDiscountPercent, 90),
    enforceLimits: v.enforceLimits === true,
    redialFreeMinutes: num(v.redialFreeMinutes, DEFAULT_BILLING.redialFreeMinutes, 100_000),
  };
}

export async function getBillingSettings(supabase: SupabaseClient): Promise<BillingSettings> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "billing").maybeSingle();
  return parseBillingSettings(data?.value);
}
