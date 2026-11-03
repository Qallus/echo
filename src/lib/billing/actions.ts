"use server";

import { redirect } from "next/navigation";
import { getUser, requireUser } from "@/lib/data";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { findPrice } from "./catalog";
import { loadCatalog } from "./catalog-server";
import { getBillingSettings } from "./settings";
import { stripe } from "./stripe";
import type { CartLine } from "./cart";

export type CheckoutResult = { url?: string; error?: string; needLogin?: boolean };

// Customers with a working AI key (their own, or their team's) get the Super
// Admin discount on subscriptions (one Stripe coupon per percentage, created
// on first use). RLS limits the lookup to keys this user can use.
async function byokCoupon(): Promise<string | null> {
  const supabase = await createClient();
  const [settings, keys] = await Promise.all([
    getBillingSettings(supabase),
    supabase.from("ai_keys").select("id").eq("status", "ok").limit(1),
  ]);
  const pct = settings.byokDiscountPercent;
  if (!pct || !keys.data?.length) return null;
  const s = (await stripe())!;
  const id = `echo-own-keys-${pct}`;
  try {
    await s.coupons.retrieve(id);
  } catch {
    await s.coupons.create({ id, percent_off: pct, duration: "forever", name: `Own AI keys (${pct}% off)` });
  }
  return id;
}

async function customerId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  return data?.stripe_customer_id ?? null;
}

// Cart -> Stripe Checkout. Anything recurring makes it a subscription
// checkout; one-off items then go on the first invoice.
export async function startCheckout(lines: CartLine[]): Promise<CheckoutResult> {
  const user = await getUser();
  if (!user) return { needLogin: true };
  const s = await stripe();
  if (!s) return { error: "Checkout isn't switched on yet. Please try again soon." };

  await loadCatalog();
  const items = lines.map((l) => ({ ...l, hit: findPrice(l.key) })).filter((l) => l.hit && l.quantity > 0);
  if (!items.length) return { error: "Your cart is empty." };
  if (items.filter((l) => l.hit!.product.kind === "plan").length > 1) return { error: "Choose one plan." };

  const keys = items.map((l) => l.key);
  const prices = await s.prices.list({ lookup_keys: keys, active: true, limit: 100 });
  const byKey = new Map(prices.data.map((p) => [p.lookup_key, p.id]));
  const missing = keys.filter((k) => !byKey.has(k));
  if (missing.length) return { error: `Not available in Stripe yet: ${missing.join(", ")}. (Run npm run stripe:setup.)` };

  const recurring = items.some((l) => l.hit!.price.interval);
  const origin = await siteOrigin();
  const customer = await customerId(user.id);
  const meta = { echo_user_id: user.id };
  // Stripe allows either an automatic discount or promo-code entry, not both.
  const coupon = recurring ? await byokCoupon() : null;

  const session = await s.checkout.sessions.create({
    mode: recurring ? "subscription" : "payment",
    line_items: items.map((l) => ({ price: byKey.get(l.key)!, quantity: l.quantity })),
    client_reference_id: user.id,
    metadata: meta,
    ...(customer ? { customer } : { customer_email: user.email }),
    ...(recurring
      ? { subscription_data: { metadata: meta } }
      : { invoice_creation: { enabled: true, invoice_data: { metadata: meta } }, ...(customer ? {} : { customer_creation: "always" as const }) }),
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
    billing_address_collection: "auto",
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
  });
  return session.url ? { url: session.url } : { error: "Couldn't start checkout." };
}

// Stripe's hosted portal: change plan or seats, update card, cancel, invoices.
export async function openBillingPortal() {
  const user = await requireUser();
  const s = await stripe();
  const customer = await customerId(user.id);
  if (!s || !customer) redirect("/billing?portal=unavailable");
  const portal = await s.billingPortal.sessions.create({ customer, return_url: `${await siteOrigin()}/billing` });
  redirect(portal.url);
}
