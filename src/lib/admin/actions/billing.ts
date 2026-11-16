"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import type { Interval, Kind, Tier } from "@/lib/billing/catalog";
import { invalidateCatalog, loadFullCatalog } from "@/lib/billing/catalog-server";
import { dayEnd, dayStart, rulesFromMetadata, rulesToMetadata, type PromoDuration, type PromoRules } from "@/lib/billing/promo-rules";
import { getBillingSettings, parseBillingSettings, type BillingSettings } from "@/lib/billing/settings";
import { stripe } from "@/lib/billing/stripe";
import { syncProductToStripe, type SyncResult } from "@/lib/billing/stripe-sync";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };

const done = (msg: string): Result => {
  invalidateCatalog();
  revalidatePath("/admin/billing");
  revalidatePath("/pricing");
  return { ok: msg };
};

// After a catalog change: push that product to Stripe when Stripe is set up.
async function pushToStripe(productId: string): Promise<string> {
  const s = await stripe();
  if (!s) return " Stripe isn't connected yet; use Sync to Stripe once the keys are in.";
  const supabase = await createClient();
  const product = (await loadFullCatalog(supabase)).find((p) => p.id === productId);
  if (!product) return "";
  try {
    const r = await syncProductToStripe(s, product);
    return r.created.length || r.updated.length ? " Stripe updated (new prices; existing subscribers keep theirs)." : "";
  } catch (e) {
    return ` Saved, but Stripe didn't update: ${e instanceof Error ? e.message : e}`;
  }
}

// sort is only changed when given (it orders the plans on /pricing).
export async function saveProduct(id: string, input: { name: string; tagline: string; features: string[]; minutes: number | null; echoMinutes?: number | null; phones?: number | null; active: boolean; sort?: number }): Promise<Result> {
  await requireStaff("billing.manage");
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give the product a name." };
  const row = {
    name, tagline: input.tagline.trim().slice(0, 300),
    features: input.features.map((f) => f.trim()).filter(Boolean).slice(0, 12).map((f) => f.slice(0, 120)),
    minutes: input.minutes == null || Number.isNaN(input.minutes) ? null : Math.max(0, Math.round(input.minutes)),
    active: input.active,
    ...(input.sort === undefined ? {} : { sort: Math.round(input.sort) || 0 }),
    ...(input.echoMinutes === undefined ? {} : { echo_minutes: input.echoMinutes == null || Number.isNaN(input.echoMinutes) ? null : Math.max(0, Math.round(input.echoMinutes)) }),
    ...(input.phones === undefined ? {} : { phones: input.phones == null || Number.isNaN(input.phones) ? null : Math.min(100, Math.max(1, Math.round(input.phones))) }),
  };
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_products").update(row).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "billing.product.save", { type: "product", id }, row);
  return done(`Saved.${await pushToStripe(id)}`);
}

export async function savePrice(key: string, input: { unitAmount?: number | null; tiers?: Tier[] | null; active: boolean }): Promise<Result> {
  await requireStaff("billing.manage");
  const supabase = await createClient();
  const { data: before } = await supabase.from("catalog_prices").select("product_id, unit_amount, tiers, active").eq("key", key).maybeSingle();
  if (!before) return { error: "Price not found." };
  const tiers = input.tiers?.length ? input.tiers.map((t) => ({ upTo: t.upTo == null ? null : Math.round(t.upTo), unitAmount: Math.round(t.unitAmount) })) : null;
  if (tiers && (tiers.some((t) => t.unitAmount < 0 || (t.upTo != null && t.upTo < 1)) || tiers.at(-1)!.upTo != null)) {
    return { error: "Tiers need amounts of 0 or more, and the last tier must have no upper limit." };
  }
  const unit = tiers ? null : input.unitAmount == null ? null : Math.round(input.unitAmount);
  if (!tiers && (unit == null || unit < 0)) return { error: "Enter a price of 0 or more." };
  const row = { unit_amount: unit, tiers, active: input.active };
  const { error } = await supabase.from("catalog_prices").update(row).eq("key", key);
  if (error) return { error: error.message };
  await adminAudit(supabase, "billing.price.save", { type: "price", id: key }, { from: before, to: row });
  return done(`Price saved.${await pushToStripe(before.product_id)}`);
}

export async function addProduct(input: { id: string; kind: Kind; name: string; tagline: string; priceKey: string; interval: Interval | null; unitAmount: number }): Promise<Result> {
  await requireStaff("billing.manage");
  const id = input.id.trim().toLowerCase();
  const key = input.priceKey.trim().toLowerCase();
  if (!/^[a-z0-9_]{1,40}$/.test(id) || !/^[a-z0-9_]{1,60}$/.test(key)) return { error: "IDs use lowercase letters, numbers and underscores." };
  if (!input.name.trim()) return { error: "Give the product a name." };
  if (!(input.unitAmount >= 0)) return { error: "Enter a price of 0 or more." };
  const supabase = await createClient();
  const p = await supabase.from("catalog_products").insert({ id, kind: input.kind, name: input.name.trim().slice(0, 80), tagline: input.tagline.trim().slice(0, 300), sort: 1000 });
  if (p.error) return { error: p.error.code === "23505" ? "A product with that ID already exists." : p.error.message };
  const pr = await supabase.from("catalog_prices").insert({ key, product_id: id, interval: input.interval, unit_amount: Math.round(input.unitAmount) });
  if (pr.error) {
    await supabase.from("catalog_products").delete().eq("id", id);
    return { error: pr.error.code === "23505" ? "A price with that key already exists." : pr.error.message };
  }
  await adminAudit(supabase, "billing.product.add", { type: "product", id }, input);
  return done(`${input.name} added.${await pushToStripe(id)}`);
}

// Creates or updates every Stripe product and price to match the catalog.
export async function syncCatalogToStripe(): Promise<Result> {
  await requireStaff("billing.manage");
  const s = await stripe();
  if (!s) return { error: "Add STRIPE_SECRET_KEY first (test mode is fine)." };
  const supabase = await createClient();
  const result: SyncResult = { created: [], updated: [], unchanged: [] };
  try {
    for (const p of await loadFullCatalog(supabase)) await syncProductToStripe(s, p, result);
  } catch (e) {
    return { error: `Stripe sync stopped: ${e instanceof Error ? e.message : e}` };
  }
  await adminAudit(supabase, "billing.stripe.sync", undefined, { ...result });
  return done(`Stripe is in sync: ${result.created.length} new, ${result.updated.length} changed, ${result.unchanged.length} unchanged.`);
}

// Full refund of an order's payment through Stripe; the webhook then marks it refunded.
export async function refundOrder(orderId: string, reason: string): Promise<Result> {
  await requireStaff("billing.manage");
  if (!isUuid(orderId)) return { error: "Invalid order." };
  const s = await stripe();
  if (!s) return { error: "Stripe isn't connected." };
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("number, total, status, stripe_payment_intent_id").eq("id", orderId).maybeSingle();
  if (!order) return { error: "Order not found." };
  if (!order.stripe_payment_intent_id) return { error: "This order has no card payment to refund here. Refund it in the Stripe dashboard." };
  try {
    await s.refunds.create({ payment_intent: order.stripe_payment_intent_id, reason: "requested_by_customer", metadata: { echo_order: String(order.number), note: reason.slice(0, 200) } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await adminAudit(supabase, "billing.order.refund", { type: "order", id: orderId }, { number: order.number, total: order.total, reason });
  revalidatePath("/admin/billing");
  return { ok: `Refund started for order #${order.number}. It shows as refunded once Stripe confirms.` };
}

export type PromoInput = {
  code: string; name: string; type: "percent" | "amount"; value: number; // percent, or dollars
  duration: PromoDuration; months?: number | null;
  startsOn?: string | null; expiresOn?: string | null; // YYYY-MM-DD, Arizona time
  maxUses?: number | null; perCustomer?: number | null;
  minOrder?: number | null; maxOrder?: number | null; // dollars
  firstTimeOnly?: boolean; email?: string | null; products?: string[]; note?: string;
};

const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const whole = (v?: number | null) => (v == null || Number.isNaN(v) ? null : Math.round(v));
const cents = (dollars?: number | null) => (dollars == null || Number.isNaN(dollars) || dollars <= 0 ? null : Math.round(dollars * 100));

// The rules Echo keeps (editable later); null + message when something's off.
function echoRules(input: Pick<PromoInput, "startsOn" | "maxOrder" | "perCustomer" | "email" | "products" | "note">, minOrder: number | null): [PromoRules | null, string?] {
  const perCustomer = whole(input.perCustomer);
  if (perCustomer != null && perCustomer < 1) return [null, "Uses per customer must be 1 or more."];
  const maxOrder = cents(input.maxOrder);
  if (maxOrder != null && minOrder != null && maxOrder < minOrder) return [null, "The maximum order is below the minimum."];
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return [null, "Enter a valid email, or leave it empty."];
  const start = day(input.startsOn);
  return [{ startsAt: start ? dayStart(start) : null, maxOrder, perCustomer, email, products: [...new Set(input.products ?? [])].filter((p) => /^[a-z0-9_]{1,40}$/.test(p)), note: (input.note ?? "").trim().slice(0, 500) }];
}

// A promo code customers enter in the cart: a Stripe coupon (the discount)
// plus a promotion code (the code and its limits).
export async function createPromoCode(input: PromoInput): Promise<Result> {
  await requireStaff("billing.manage");
  const s = await stripe();
  if (!s) return { error: "Stripe isn't connected." };
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { error: "Codes use 3-40 letters, numbers, dashes or underscores." };
  const name = (input.name.trim() || code).slice(0, 40);
  const pct = input.type === "percent" ? input.value : null;
  const amt = input.type === "amount" ? cents(input.value) : null;
  if (pct != null && !(pct > 0 && pct <= 100)) return { error: "A percentage is between 1 and 100." };
  if (input.type === "amount" && !amt) return { error: "Enter the dollar amount off." };
  const months = whole(input.months);
  if (input.duration === "repeating" && !(months && months > 0 && months <= 36)) return { error: "Enter how many months it repeats (1-36)." };
  const maxUses = whole(input.maxUses);
  if (maxUses != null && maxUses < 1) return { error: "Total uses must be 1 or more." };
  const minOrder = cents(input.minOrder);
  const [rules, problem] = echoRules(input, minOrder);
  if (!rules) return { error: problem };
  const expires = day(input.expiresOn);
  const expiresAt = expires ? Math.floor(Date.parse(dayEnd(expires)) / 1000) : null;
  if (expiresAt && expiresAt * 1000 <= Date.now()) return { error: "The expiration date has already passed." };
  if (expiresAt && rules.startsAt && expiresAt * 1000 <= Date.parse(rules.startsAt)) return { error: "The code expires before it starts." };

  try {
    if ((await s.promotionCodes.list({ code, limit: 1 })).data.length) return { error: `${code} already exists. Pick another code.` };
    // Stripe limits the coupon to these products too (found by their Echo id).
    const stripeProducts: string[] = [];
    for (const id of rules.products) {
      const found = (await s.products.search({ query: `metadata['echo_id']:'${id}'` })).data[0];
      if (!found) return { error: `"${id}" isn't in Stripe yet. Run Sync to Stripe on the Catalog tab first.` };
      stripeProducts.push(found.id);
    }
    const coupon = await s.coupons.create({
      ...(pct != null ? { percent_off: pct } : { amount_off: amt!, currency: "usd" }),
      duration: input.duration, ...(input.duration === "repeating" ? { duration_in_months: months! } : {}), name,
      ...(stripeProducts.length ? { applies_to: { products: stripeProducts } } : {}),
      metadata: { echo_code: code },
    });
    await s.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id }, code,
      ...(maxUses ? { max_redemptions: maxUses } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      restrictions: { first_time_transaction: Boolean(input.firstTimeOnly), ...(minOrder ? { minimum_amount: minOrder, minimum_amount_currency: "usd" } : {}) },
      metadata: rulesToMetadata(rules),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  const supabase = await createClient();
  await adminAudit(supabase, "billing.promo.create", { type: "promo", id: code }, { ...input });
  revalidatePath("/admin/billing");
  return { ok: rules.startsAt && Date.parse(rules.startsAt) > Date.now() ? `${code} is saved and starts ${input.startsOn}.` : `${code} is live. Customers enter it in the cart.` };
}

// Echo's own rules can change any time; Stripe's (amount, expiry, total uses,
// minimum, products) are fixed once a code exists.
export async function updatePromoCode(id: string, input: Pick<PromoInput, "startsOn" | "maxOrder" | "perCustomer" | "email" | "note">): Promise<Result> {
  await requireStaff("billing.manage");
  const s = await stripe();
  if (!s) return { error: "Stripe isn't connected." };
  if (!/^promo_[A-Za-z0-9]+$/.test(id)) return { error: "Invalid code." };
  try {
    const current = await s.promotionCodes.retrieve(id);
    // Products are fixed with the Stripe coupon, so they're kept as they are.
    const [rules, problem] = echoRules({ ...input, products: rulesFromMetadata(current.metadata).products }, current.restrictions?.minimum_amount ?? null);
    if (!rules) return { error: problem };
    await s.promotionCodes.update(id, { metadata: rulesToMetadata(rules) });
    const supabase = await createClient();
    await adminAudit(supabase, "billing.promo.update", { type: "promo", id }, { code: current.code, ...rules });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/billing");
  return { ok: "Saved." };
}

export async function setPromoCodeActive(id: string, active: boolean): Promise<Result> {
  await requireStaff("billing.manage");
  const s = await stripe();
  if (!s) return { error: "Stripe isn't connected." };
  try {
    await s.promotionCodes.update(id, { active });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  const supabase = await createClient();
  await adminAudit(supabase, active ? "billing.promo.enable" : "billing.promo.disable", { type: "promo", id });
  revalidatePath("/admin/billing");
  return { ok: active ? "Code turned on." : "Code turned off." };
}

export async function saveBillingSettings(input: BillingSettings): Promise<Result> {
  await requireStaff("billing.manage");
  const next = parseBillingSettings(input);
  const supabase = await createClient();
  const before = await getBillingSettings(supabase);
  const { error } = await supabase.from("platform_settings").upsert({ key: "billing", value: next }, { onConflict: "key" });
  if (error) return { error: error.message };
  await adminAudit(supabase, "billing.settings.save", { type: "setting", id: "billing" }, { from: before, to: next });
  revalidatePath("/admin/billing");
  return { ok: "Saved." };
}
