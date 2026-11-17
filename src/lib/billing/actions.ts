"use server";

import { redirect } from "next/navigation";
import { getUser, requireUser } from "@/lib/data";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { LINE_NAME, amountFor, findPrice, lineOf, type Line } from "./catalog";
import { loadCatalog } from "./catalog-server";
import { checkPromo, type PromoCheck } from "./promo";
import { NUMBER_PLAN_PRICE, NUMBER_PRICE, isNumberKey, stillAvailable } from "@/lib/redial/numbers";
import { normalizeNumber } from "@/lib/redial/types";
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
// The cart's "Apply" button: checks a promo code against the cart (and the
// signed-in customer, if any) and estimates the discount. Checkout checks again.
export async function previewPromo(lines: CartLine[], code: string): Promise<PromoCheck> {
  const s = await stripe();
  if (!s) return { ok: false, error: "Promo codes aren't available yet." };
  await loadCatalog();
  const items = promoItems(lines);
  if (!items.length) return { ok: false, error: "Your cart is empty." };
  const user = await getUser();
  try {
    return await checkPromo(s, await createClient(), code, user ? { id: user.id, email: user.email } : null, items);
  } catch {
    return { ok: false, error: "Couldn't check that code. Please try again." };
  }
}

const promoItems = (lines: CartLine[]) => lines.flatMap((l) => {
  const hit = findPrice(l.key);
  return hit && l.quantity > 0 ? [{ productId: hit.product.id, amount: amountFor(hit.price, l.quantity) }] : [];
});

export async function startCheckout(lines: CartLine[], promoCode?: string, opts: { phoneNumber?: string | null } = {}): Promise<CheckoutResult> {
  const user = await getUser();
  if (!user) return { needLogin: true };
  const s = await stripe();
  if (!s) return { error: "Checkout isn't switched on yet. Please try again soon." };

  await loadCatalog();
  let items = lines.map((l) => ({ ...l, hit: findPrice(l.key) })).filter((l) => l.hit && l.quantity > 0);
  if (!items.length) return { error: "Your cart is empty." };
  const planLines = items.filter((l) => l.hit!.product.kind === "plan").map((l) => lineOf(l.hit!.product));
  if (new Set(planLines).size !== planLines.length) return { error: "Choose one Redial plan and at most one Echo plan." };
  // Plans already held (a second one in the same line would be a second
  // subscription; change the current one in Billing instead).
  const supabase = await createClient();
  const { data: subs } = await supabase.from("subscriptions").select("items").eq("user_id", user.id).in("status", ["active", "trialing", "past_due"]);
  const held = new Set<Line>();
  for (const sub of subs ?? []) for (const i of (sub.items ?? []) as { price_key: string }[]) {
    const p = findPrice(i.price_key)?.product;
    if (p?.kind === "plan") held.add(lineOf(p));
  }
  const clash = planLines.find((l) => held.has(l));
  if (clash) return { error: `You already have a ${LINE_NAME[clash]} plan. Change it in Billing instead.` };

  // A phone number: one per checkout, the one they picked, still for sale;
  // $2.50/mo with a Redial plan (in the cart or already held), else $5/mo.
  let phoneNumber: string | null = null;
  if (items.some((l) => isNumberKey(l.key))) {
    phoneNumber = normalizeNumber(opts.phoneNumber ?? "");
    if (!phoneNumber?.startsWith("+1")) return { error: "Pick your phone number first (Numbers page)." };
    const free = await stillAvailable(phoneNumber);
    if (free === false) return { error: `${phoneNumber.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")} was just taken. Pick another number.` };
    const withPlan = planLines.includes("redial") || held.has("redial");
    const key = withPlan ? NUMBER_PLAN_PRICE : NUMBER_PRICE;
    items = items.filter((l, i, all) => !isNumberKey(l.key) || all.findIndex((x) => isNumberKey(x.key)) === i)
      .map((l) => (isNumberKey(l.key) ? { ...l, key, quantity: 1, hit: findPrice(key) } : l));
  }

  const keys = items.map((l) => l.key);
  const prices = await s.prices.list({ lookup_keys: keys, active: true, limit: 100 });
  const byKey = new Map(prices.data.map((p) => [p.lookup_key, p.id]));
  const missing = keys.filter((k) => !byKey.has(k));
  if (missing.length) return { error: `Not available in Stripe yet: ${missing.join(", ")}. (Run npm run stripe:setup.)` };

  const recurring = items.some((l) => l.hit!.price.interval);
  const origin = await siteOrigin();
  const customer = await customerId(user.id);
  // A promo code from the cart (checked again here) replaces the own-AI-keys
  // discount: a checkout takes one discount. Codes are only entered in the
  // cart, where Echo's rules apply, so Stripe's own code box stays off.
  let promo: Extract<PromoCheck, { ok: true }> | null = null;
  if (promoCode?.trim()) {
    const check = await checkPromo(s, await createClient(), promoCode, { id: user.id, email: user.email }, promoItems(lines));
    if (!check.ok) return { error: check.error };
    promo = check;
  }
  const meta: Record<string, string> = {
    echo_user_id: user.id, ...(promo ? { promo_code_id: promo.id, promo_code: promo.code } : {}), ...(phoneNumber ? { phone_number: phoneNumber } : {}),
  };
  const coupon = !promo && recurring ? await byokCoupon() : null;

  const session = await s.checkout.sessions.create({
    mode: recurring ? "subscription" : "payment",
    line_items: items.map((l) => ({ price: byKey.get(l.key)!, quantity: l.quantity })),
    client_reference_id: user.id,
    metadata: meta,
    ...(customer ? { customer } : { customer_email: user.email }),
    ...(recurring
      ? { subscription_data: { metadata: meta } }
      : { invoice_creation: { enabled: true, invoice_data: { metadata: meta } }, ...(customer ? {} : { customer_creation: "always" as const }) }),
    ...(promo ? { discounts: [{ promotion_code: promo.id }] } : coupon ? { discounts: [{ coupon }] } : {}),
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
