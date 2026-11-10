import "server-only";
import type Stripe from "stripe";
import { lineOf, type Product } from "./catalog";

// Makes Stripe match one catalog product: the product (found by metadata
// echo_id) and each price (found by lookup_key). Stripe prices can't change,
// so a changed amount, tier or interval creates a new price, moves the lookup
// key to it and archives the old one; existing subscribers keep their price.
// Same rules as scripts/stripe-setup.mjs.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type SyncResult = { created: string[]; updated: string[]; unchanged: string[] };

// Name on receipts and in Stripe: "Redial ..." or "Echo ...".
const stripeName = (p: Product) => {
  const brand = lineOf(p) === "redial" ? "Redial" : "Echo";
  return p.name.startsWith(brand) ? p.name : `${brand} ${p.name}`;
};

export async function syncProductToStripe(s: Stripe, p: Product, result: SyncResult = { created: [], updated: [], unchanged: [] }) {
  const found = await s.products.search({ query: `metadata['echo_id']:'${p.id}'` });
  const active = p.active !== false;
  const name = stripeName(p);
  const product = found.data[0]
    ? await s.products.update(found.data[0].id, { name, description: p.tagline || undefined, active })
    : await s.products.create({ name, description: p.tagline || undefined, active, metadata: { echo_id: p.id, echo_kind: p.kind } });

  for (const price of p.prices) {
    const existing = (await s.prices.list({ lookup_keys: [price.key], expand: ["data.tiers"], limit: 1 })).data[0];
    if (price.active === false) {
      if (existing?.active) await s.prices.update(existing.id, { active: false });
      continue;
    }
    const wantTiers = price.tiers?.map((t) => ({ up_to: t.upTo ?? ("inf" as const), unit_amount: t.unitAmount }));
    const haveTiers = existing?.tiers?.map((t) => ({ up_to: t.up_to ?? "inf", unit_amount: t.unit_amount }));
    const unchanged = existing && existing.active && existing.product === product.id &&
      (price.tiers ? same(wantTiers, haveTiers) : existing.unit_amount === price.unitAmount) &&
      (existing.recurring?.interval ?? null) === price.interval;
    if (unchanged) { result.unchanged.push(price.key); continue; }

    await s.prices.create({
      product: product.id,
      currency: "usd",
      lookup_key: price.key,
      transfer_lookup_key: true,
      ...(price.interval ? { recurring: { interval: price.interval } } : {}),
      ...(price.tiers
        ? { billing_scheme: "tiered" as const, tiers_mode: "graduated" as const, tiers: wantTiers }
        : { unit_amount: price.unitAmount }),
      metadata: { echo_id: p.id },
    });
    if (existing && existing.active) await s.prices.update(existing.id, { active: false });
    (existing ? result.updated : result.created).push(price.key);
  }
  return result;
}
