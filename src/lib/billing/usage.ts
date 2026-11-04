import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPrice } from "./catalog";
import { loadCatalog } from "./catalog-server";
import { getBillingSettings } from "./settings";

export type MinutesUsage = { used: number; plan: number; packs: number; allowance: number; planName: string | null };

// Minutes this calendar month against the allowance: the plan's minutes (per
// seat for per-seat plans) or the free minutes, plus packs bought in the last
// 12 months. Reads with the given client, so RLS decides whose data it sees.
export async function minutesUsage(supabase: SupabaseClient, userId: string): Promise<MinutesUsage> {
  await loadCatalog();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString();
  const [settings, recs, subs, packs] = await Promise.all([
    getBillingSettings(supabase),
    supabase.from("recordings").select("duration_sec").eq("created_by", userId).gte("created_at", monthStart),
    supabase.from("subscriptions").select("status, items").eq("user_id", userId).in("status", ["active", "trialing", "past_due"]),
    supabase.from("order_items").select("price_key, quantity, orders!inner(user_id, status, created_at)")
      .eq("orders.user_id", userId).eq("orders.status", "paid").gte("orders.created_at", yearAgo),
  ]);

  const used = Math.round((recs.data ?? []).reduce((n, r) => n + (r.duration_sec ?? 0), 0) / 60);
  let plan = 0;
  let planName: string | null = null;
  for (const s of subs.data ?? []) {
    for (const item of (s.items ?? []) as { price_key: string; quantity: number }[]) {
      const hit = findPrice(item.price_key);
      if (hit?.product.kind !== "plan" || hit.product.meter === "redial" || !hit.product.minutes) continue;
      plan += hit.product.minutes * (hit.product.perSeat ? item.quantity ?? 1 : 1);
      planName = hit.product.name;
    }
  }
  const packMinutes = (packs.data ?? []).reduce((n, i) => {
    const hit = i.price_key ? findPrice(i.price_key) : null;
    return n + (hit?.product.kind === "pack" && hit.product.meter !== "redial" ? (hit.product.minutes ?? 0) * (i.quantity ?? 1) : 0);
  }, 0);
  const base = plan || settings.freeMinutes;
  return { used, plan: base, packs: packMinutes, allowance: base + packMinutes, planName };
}
