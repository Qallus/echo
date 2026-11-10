import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SEED_PRODUCTS, setCatalog, type Interval, type Kind, type Line, type Meter, type Product, type Tier } from "./catalog";

// Loads the store catalog from the database (active items for customers;
// staff with billing.view also get inactive ones when includeInactive).
// Cached for a minute per server; admin edits call invalidateCatalog().

type ProductRow = {
  id: string; kind: Kind; name: string; tagline: string; features: string[]; per_seat: boolean; minutes: number | null; sort: number; active: boolean;
  meter?: Meter; product_line?: Line; echo_minutes?: number | null; phones?: number | null;
};
type PriceRow = { key: string; product_id: string; interval: Interval | null; unit_amount: number | null; tiers: Tier[] | null; active: boolean };

let cache: { at: number; products: Product[] } | null = null;
const TTL = 60_000;

export function invalidateCatalog() {
  cache = null;
}

export function toProducts(products: ProductRow[], prices: PriceRow[]): Product[] {
  return products
    .slice().sort((a, b) => a.sort - b.sort)
    .map((p) => ({
      id: p.id, kind: p.kind, name: p.name, tagline: p.tagline, features: p.features?.length ? p.features : undefined,
      perSeat: p.per_seat || undefined, minutes: p.minutes, meter: p.meter === "redial" ? "redial" : undefined, active: p.active,
      line: p.product_line === "redial" ? "redial" : "echo", echoMinutes: p.echo_minutes ?? null, phones: p.phones ?? null,
      prices: prices.filter((x) => x.product_id === p.id).map((x) => ({
        key: x.key, interval: x.interval, unitAmount: x.unit_amount ?? undefined, tiers: x.tiers ?? undefined, active: x.active,
      })),
    }));
}

async function fetchCatalog(supabase: SupabaseClient, includeInactive: boolean): Promise<Product[] | null> {
  const [products, prices] = await Promise.all([
    supabase.from("catalog_products").select("id, kind, name, tagline, features, per_seat, minutes, sort, active, meter, product_line, echo_minutes, phones"),
    supabase.from("catalog_prices").select("key, product_id, interval, unit_amount, tiers, active"),
  ]);
  if (products.error || prices.error || !products.data?.length) return null;
  const list = toProducts(products.data as ProductRow[], prices.data as PriceRow[]);
  return includeInactive ? list : list.filter((p) => p.active).map((p) => ({ ...p, prices: p.prices.filter((x) => x.active) })).filter((p) => p.prices.length);
}

// The active catalog, as customers see it. Also becomes the server's current
// catalog, so findPrice() matches what the pages show.
export async function loadCatalog(): Promise<Product[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.products;
  const fresh = await fetchCatalog(await createClient(), false);
  const list = fresh ?? SEED_PRODUCTS.filter((p) => p.active !== false);
  cache = { at: Date.now(), products: list };
  setCatalog(list);
  return list;
}

// Everything, inactive included (Admin > Billing).
export async function loadFullCatalog(supabase: SupabaseClient): Promise<Product[]> {
  return (await fetchCatalog(supabase, true)) ?? SEED_PRODUCTS;
}
