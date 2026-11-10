"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import type { Interval, Kind, Tier } from "@/lib/billing/catalog";
import { invalidateCatalog, loadFullCatalog } from "@/lib/billing/catalog-server";
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
export async function saveProduct(id: string, input: { name: string; tagline: string; features: string[]; minutes: number | null; echoMinutes?: number | null; active: boolean; sort?: number }): Promise<Result> {
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

// A promotion code customers enter at checkout.
export async function createPromoCode(input: { code: string; percentOff?: number; amountOff?: number; duration: "once" | "repeating" | "forever"; months?: number; maxRedemptions?: number }): Promise<Result> {
  await requireStaff("billing.manage");
  const s = await stripe();
  if (!s) return { error: "Stripe isn't connected." };
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { error: "Codes use 3-40 letters, numbers, dashes or underscores." };
  const pct = input.percentOff && input.percentOff > 0 ? Math.min(100, input.percentOff) : null;
  const amt = !pct && input.amountOff && input.amountOff > 0 ? Math.round(input.amountOff) : null;
  if (!pct && !amt) return { error: "Enter a percentage or an amount off." };
  if (input.duration === "repeating" && !(input.months && input.months > 0)) return { error: "Enter how many months it repeats." };
  try {
    const coupon = await s.coupons.create({
      ...(pct ? { percent_off: pct } : { amount_off: amt!, currency: "usd" }),
      duration: input.duration, ...(input.duration === "repeating" ? { duration_in_months: input.months } : {}), name: code,
    });
    await s.promotionCodes.create({ promotion: { type: "coupon", coupon: coupon.id }, code, ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  const supabase = await createClient();
  await adminAudit(supabase, "billing.promo.create", { type: "promo", id: code }, input);
  revalidatePath("/admin/billing");
  return { ok: `${code} is live. Customers enter it at checkout.` };
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
