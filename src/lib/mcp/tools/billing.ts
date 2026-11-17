import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { adminAudit } from "@/lib/admin/audit";
import { invalidateCatalog, loadFullCatalog } from "@/lib/billing/catalog-server";
import { toPromoRow } from "@/lib/billing/promo";
import { dayEnd, dayStart, discountLabel, promoStatus, rulesFromMetadata, rulesToMetadata, type PromoRules } from "@/lib/billing/promo-rules";
import { getBillingSettings, parseBillingSettings } from "@/lib/billing/settings";
import { stripe } from "@/lib/billing/stripe";
import { syncProductToStripe, type SyncResult } from "@/lib/billing/stripe-sync";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { check, found, id } from "./shared";

// Billing for staff (Admin -> Billing), as action tools: the catalog and its
// Stripe sync, promo codes, refunds and billing settings. Orders and
// subscriptions are the order / subscription resources. Same rules as
// src/lib/admin/actions/billing.ts; everything runs as the caller, so the
// database re-checks billing.view / billing.manage. Money-moving and
// customer-facing changes need confirm_action.

type Perms = string[];
const need = (perms: Perms, p: string) => { if (!perms.includes(p)) throw new ToolError(`That needs the ${p} permission.`); };
async function stripeOrFail() {
  const s = await stripe();
  if (!s) throw new ToolError("Stripe isn't connected (Admin -> Settings -> Integrations).");
  return s;
}
const stripeError = (e: unknown) => new ToolError(e instanceof Error ? e.message : String(e));

const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const whole = (v?: number | null) => (v == null || Number.isNaN(v) ? null : Math.round(v));
const cents = (dollars?: number | null) => (dollars == null || Number.isNaN(dollars) || dollars <= 0 ? null : Math.round(dollars * 100));

// Echo's own promo rules (start, max order, per customer, email, products, note).
function echoRules(input: { starts_on?: string | null; max_order?: number | null; per_customer?: number | null; email?: string | null; products?: string[]; note?: string }, minOrder: number | null): PromoRules {
  const perCustomer = whole(input.per_customer);
  if (perCustomer != null && perCustomer < 1) throw new ToolError("per_customer must be 1 or more.");
  const maxOrder = cents(input.max_order);
  if (maxOrder != null && minOrder != null && maxOrder < minOrder) throw new ToolError("max_order is below the minimum order.");
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ToolError("Enter a valid email, or leave it out.");
  const start = day(input.starts_on);
  return {
    startsAt: start ? dayStart(start) : null, maxOrder, perCustomer, email,
    products: [...new Set(input.products ?? [])].filter((p) => /^[a-z0-9_]{1,40}$/.test(p)), note: (input.note ?? "").trim().slice(0, 500),
  };
}

// ---------------------------------------------------------------------------
// Confirmed actions
// ---------------------------------------------------------------------------
confirmable("billing_stripe_sync", async (ctx) => {
  const s = await stripeOrFail();
  const result: SyncResult = { created: [], updated: [], unchanged: [] };
  try {
    for (const p of await loadFullCatalog(ctx.supabase)) await syncProductToStripe(s, p, result);
  } catch (e) {
    throw new ToolError(`Stripe sync stopped: ${e instanceof Error ? e.message : e}`);
  }
  await adminAudit(ctx.supabase, "billing.stripe.sync", undefined, { ...result, via: "mcp" });
  invalidateCatalog();
  return { data: { synced: true, created: result.created.length, updated: result.updated.length, unchanged: result.unchanged.length } };
});

confirmable("billing_refund", async (ctx, p) => {
  const s = await stripeOrFail();
  const { data: order, error } = await ctx.supabase.from("orders").select("id, number, total, status, stripe_payment_intent_id").eq("id", String(p.order_id)).maybeSingle();
  check(error);
  const o = found(order, "Order");
  if (!o.stripe_payment_intent_id) throw new ToolError("This order has no card payment to refund here. Refund it in the Stripe dashboard.");
  try {
    await s.refunds.create({ payment_intent: o.stripe_payment_intent_id, reason: "requested_by_customer", metadata: { echo_order: String(o.number), note: String(p.reason ?? "").slice(0, 200) } },
      { idempotencyKey: `mcp-refund-${o.id}` });
  } catch (e) { throw stripeError(e); }
  await adminAudit(ctx.supabase, "billing.order.refund", { type: "order", id: o.id }, { number: o.number, total: o.total, reason: p.reason, via: "mcp" });
  return { targetId: o.id, data: { refund_started: true, order: o.number, note: "It shows as refunded once Stripe confirms (a minute or two)." } };
});

confirmable("billing_promo_create", async (ctx, p) => {
  const s = await stripeOrFail();
  const i = p as Record<string, unknown> & { code: string; name: string; percent_off: number | null; amount_off_cents: number | null; duration: "once" | "repeating" | "forever";
    months: number | null; expires_at: number | null; max_uses: number | null; min_order: number | null; first_time_only: boolean; rules: PromoRules };
  try {
    if ((await s.promotionCodes.list({ code: i.code, limit: 1 })).data.length) throw new ToolError(`${i.code} already exists. Pick another code.`);
    const stripeProducts: string[] = [];
    for (const pid of i.rules.products) {
      const hit = (await s.products.search({ query: `metadata['echo_id']:'${pid}'` })).data[0];
      if (!hit) throw new ToolError(`"${pid}" isn't in Stripe yet. Run billing_stripe_sync first.`);
      stripeProducts.push(hit.id);
    }
    const coupon = await s.coupons.create({
      ...(i.percent_off != null ? { percent_off: i.percent_off } : { amount_off: i.amount_off_cents!, currency: "usd" }),
      duration: i.duration, ...(i.duration === "repeating" ? { duration_in_months: i.months! } : {}), name: i.name,
      ...(stripeProducts.length ? { applies_to: { products: stripeProducts } } : {}), metadata: { echo_code: i.code },
    });
    const promo = await s.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id }, code: i.code,
      ...(i.max_uses ? { max_redemptions: i.max_uses } : {}), ...(i.expires_at ? { expires_at: i.expires_at } : {}),
      restrictions: { first_time_transaction: i.first_time_only, ...(i.min_order ? { minimum_amount: i.min_order, minimum_amount_currency: "usd" } : {}) },
      metadata: rulesToMetadata(i.rules),
    });
    await adminAudit(ctx.supabase, "billing.promo.create", { type: "promo", id: i.code }, { ...i, via: "mcp" });
    return { targetId: promo.id, data: { created: { id: promo.id, code: i.code } } };
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw stripeError(e);
  }
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export function registerBillingTools(server: McpServer, ctx: McpContext, perms: Perms) {
  if (!perms.includes("billing.view")) return;
  const base = { prefix: "", domain: "billing" };

  defineTool(server, ctx, "billing_catalog_list", {
    ...base, risk: "read", title: "List the store catalog",
    description: "Every product (plans, bolt-ons, minute packs, services), active or not, with its prices (cents; interval month/year or one-time; per-seat tiers). Price keys are Stripe lookup keys.",
    inputSchema: z.object({}),
  }, async () => ({ data: { products: await loadFullCatalog(ctx.supabase) } }));

  defineTool(server, ctx, "billing_product_update", {
    ...base, risk: "write", title: "Update a catalog product",
    description: "Change a product's name, tagline, features (up to 12), included minutes, sort order or whether it's for sale. Only pass what changes. Stripe isn't touched: run billing_stripe_sync afterwards to push it.",
    inputSchema: z.object({
      product_id: z.string().regex(/^[a-z0-9_]{1,40}$/), name: z.string().trim().min(1).max(80).optional(), tagline: z.string().trim().max(300).optional(),
      features: z.array(z.string().trim().max(120)).max(12).optional(), minutes: z.number().int().min(0).nullable().optional(),
      echo_minutes: z.number().int().min(0).nullable().optional(), phones: z.number().int().min(1).max(100).nullable().optional(),
      active: z.boolean().optional(), sort: z.number().int().optional(),
    }),
  }, async ({ product_id, features, ...rest }) => {
    need(perms, "billing.manage");
    const row: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    if (features) row.features = features.filter(Boolean);
    if (!Object.keys(row).length) throw new ToolError("Pass at least one field to change.");
    const { data, error } = await ctx.supabase.from("catalog_products").update(row).eq("id", product_id).select("id").maybeSingle();
    check(error);
    found(data, "Product");
    await adminAudit(ctx.supabase, "billing.product.save", { type: "product", id: product_id }, { ...row, via: "mcp" });
    invalidateCatalog();
    return { targetId: product_id, data: { updated: product_id, fields: Object.keys(row), next: "Run billing_stripe_sync to update Stripe." } };
  });

  defineTool(server, ctx, "billing_price_update", {
    ...base, risk: "write", title: "Update a catalog price",
    description: "Change one price (by its key): unit_amount in cents, or graduated per-seat tiers [{upTo, unitAmount}] where the last tier has upTo null; and whether it's for sale. Existing subscribers keep their old price; run billing_stripe_sync to create the new Stripe price.",
    inputSchema: z.object({
      key: z.string().regex(/^[a-z0-9_]{1,60}$/), unit_amount: z.number().int().min(0).nullable().optional(),
      tiers: z.array(z.object({ upTo: z.number().int().min(1).nullable(), unitAmount: z.number().int().min(0) })).max(10).nullable().optional(),
      active: z.boolean().optional(),
    }),
  }, async ({ key, unit_amount, tiers, active }) => {
    need(perms, "billing.manage");
    const { data: before, error: e1 } = await ctx.supabase.from("catalog_prices").select("product_id, unit_amount, tiers, active").eq("key", key).maybeSingle();
    check(e1);
    const b = found(before, "Price");
    const row: Record<string, unknown> = {};
    if (tiers !== undefined || unit_amount !== undefined) {
      if (tiers?.length) {
        if (tiers.at(-1)!.upTo != null) throw new ToolError("The last tier must have upTo null (no upper limit).");
        Object.assign(row, { tiers, unit_amount: null });
      } else {
        if (unit_amount == null) throw new ToolError("Give unit_amount (cents) or tiers.");
        Object.assign(row, { unit_amount, tiers: null });
      }
    }
    if (active !== undefined) row.active = active;
    if (!Object.keys(row).length) throw new ToolError("Pass at least one field to change.");
    const { error } = await ctx.supabase.from("catalog_prices").update(row).eq("key", key);
    check(error);
    await adminAudit(ctx.supabase, "billing.price.save", { type: "price", id: key }, { from: b, to: row, via: "mcp" });
    invalidateCatalog();
    return { targetId: key, data: { updated: key, next: "Run billing_stripe_sync to update Stripe." } };
  });

  defineTool(server, ctx, "billing_product_add", {
    ...base, risk: "write", title: "Add a catalog product",
    description: "Add a product with its first price. ids use lowercase letters, numbers and underscores. kind: plan, bolt_on, pack or service. interval: month, year, or null for one-time. unit_amount in cents. It isn't in Stripe until billing_stripe_sync.",
    inputSchema: z.object({
      id: z.string().regex(/^[a-z0-9_]{1,40}$/), kind: z.enum(["plan", "bolt_on", "pack", "service"]), name: z.string().trim().min(1).max(80),
      tagline: z.string().trim().max(300).default(""), price_key: z.string().regex(/^[a-z0-9_]{1,60}$/), interval: z.enum(["month", "year"]).nullable(),
      unit_amount: z.number().int().min(0),
    }),
  }, async (i) => {
    need(perms, "billing.manage");
    const p = await ctx.supabase.from("catalog_products").insert({ id: i.id, kind: i.kind, name: i.name, tagline: i.tagline, sort: 1000 });
    if (p.error) throw new ToolError(p.error.code === "23505" ? "A product with that id already exists." : p.error.message);
    const pr = await ctx.supabase.from("catalog_prices").insert({ key: i.price_key, product_id: i.id, interval: i.interval, unit_amount: i.unit_amount });
    if (pr.error) {
      await ctx.supabase.from("catalog_products").delete().eq("id", i.id);
      throw new ToolError(pr.error.code === "23505" ? "A price with that key already exists." : pr.error.message);
    }
    await adminAudit(ctx.supabase, "billing.product.add", { type: "product", id: i.id }, { ...i, via: "mcp" });
    invalidateCatalog();
    return { targetId: i.id, data: { added: i.id, next: "Run billing_stripe_sync to put it in Stripe." } };
  });

  defineTool(server, ctx, "billing_stripe_sync", {
    ...base, risk: "high", previewOnly: true, title: "Sync the catalog to Stripe",
    description: "Create or update every Stripe product and price to match the catalog (changed prices become new Stripe prices; existing subscribers keep theirs). Returns a preview and confirmation_id; run with confirm_action after a clear yes.",
    inputSchema: z.object({}),
  }, async () => {
    need(perms, "billing.manage");
    const products = await loadFullCatalog(ctx.supabase);
    return prepare(ctx, "billing_stripe_sync", {}, `Sync ${products.length} catalog products to Stripe`, { products: products.map((p) => p.id) });
  });

  defineTool(server, ctx, "billing_promo_list", {
    ...base, risk: "read", title: "List promo codes",
    description: "Promo codes from Stripe with their discount, status (active, scheduled, expired, used_up, off), uses, limits and Echo's rules (start date, max order, uses per customer, email, products, note).",
    inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(50) }),
  }, async ({ limit }) => {
    const s = await stripeOrFail();
    try {
      const list = await s.promotionCodes.list({ limit, expand: ["data.promotion.coupon"] });
      return { data: { codes: list.data.map((p) => { const r = toPromoRow(p); return { ...r, status: promoStatus(r), summary: discountLabel(r) }; }) } };
    } catch (e) { throw stripeError(e); }
  });

  defineTool(server, ctx, "billing_promo_create", {
    ...base, risk: "high", previewOnly: true, title: "Create a promo code",
    description: "Create a promo code customers enter in the cart: percent_off or amount_off (dollars), how long it lasts on subscriptions (once, repeating with months, forever), optional starts_on/expires_on (YYYY-MM-DD, Arizona time), max_uses, per_customer, min_order/max_order (dollars), first_time_only, email (one customer), products (catalog ids) and a private note. The discount, expiry, total uses, minimum, products and first-time rule can't change later. Returns a preview; create it with confirm_action after a clear yes.",
    inputSchema: z.object({
      code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/), name: z.string().trim().max(40).optional(),
      percent_off: z.number().min(1).max(100).optional(), amount_off: z.number().positive().max(100000).optional(),
      duration: z.enum(["once", "repeating", "forever"]).default("once"), months: z.number().int().min(1).max(36).optional(),
      starts_on: z.string().optional(), expires_on: z.string().optional(), max_uses: z.number().int().min(1).optional(),
      per_customer: z.number().int().min(1).optional(), min_order: z.number().positive().optional(), max_order: z.number().positive().optional(),
      first_time_only: z.boolean().default(false), email: z.email().optional(), products: z.array(z.string()).max(20).optional(), note: z.string().max(500).optional(),
    }),
  }, async (i) => {
    need(perms, "billing.manage");
    const code = i.code.toUpperCase();
    if ((i.percent_off == null) === (i.amount_off == null)) throw new ToolError("Give exactly one of percent_off or amount_off.");
    if (i.duration === "repeating" && !i.months) throw new ToolError("Give months (1-36) for a repeating discount.");
    const minOrder = cents(i.min_order);
    const rules = echoRules(i, minOrder);
    const exp = day(i.expires_on);
    const expiresAt = exp ? Math.floor(Date.parse(dayEnd(exp)) / 1000) : null;
    if (expiresAt && expiresAt * 1000 <= Date.now()) throw new ToolError("The expiration date has already passed.");
    if (expiresAt && rules.startsAt && expiresAt * 1000 <= Date.parse(rules.startsAt)) throw new ToolError("The code expires before it starts.");
    const payload = {
      code, name: (i.name || code).slice(0, 40), percent_off: i.percent_off ?? null, amount_off_cents: cents(i.amount_off), duration: i.duration, months: i.months ?? null,
      expires_at: expiresAt, max_uses: i.max_uses ?? null, min_order: minOrder, first_time_only: i.first_time_only, rules,
    };
    const off = i.percent_off != null ? `${i.percent_off}% off` : `$${i.amount_off} off`;
    return prepare(ctx, "billing_promo_create", payload, `Create promo code ${code} (${off}, ${i.duration === "repeating" ? `${i.months} months` : i.duration})`, payload);
  });

  defineTool(server, ctx, "billing_promo_update", {
    ...base, risk: "write", title: "Change a promo code's rules",
    description: "Change Echo's own rules on a promo code (id promo_...): starts_on, max_order (dollars), per_customer, email, note. The discount, expiry, total uses, minimum and products are fixed in Stripe.",
    inputSchema: z.object({
      id: z.string().regex(/^promo_[A-Za-z0-9]+$/), starts_on: z.string().nullable().optional(), max_order: z.number().positive().nullable().optional(),
      per_customer: z.number().int().min(1).nullable().optional(), email: z.email().nullable().optional(), note: z.string().max(500).optional(),
    }),
  }, async ({ id: promoId, ...input }) => {
    need(perms, "billing.manage");
    const s = await stripeOrFail();
    try {
      const current = await s.promotionCodes.retrieve(promoId);
      const now = rulesFromMetadata(current.metadata);
      const rules = echoRules({
        starts_on: input.starts_on === undefined ? (now.startsAt ? now.startsAt.slice(0, 10) : null) : input.starts_on,
        max_order: input.max_order === undefined ? (now.maxOrder != null ? now.maxOrder / 100 : null) : input.max_order,
        per_customer: input.per_customer === undefined ? now.perCustomer : input.per_customer,
        email: input.email === undefined ? now.email : input.email, note: input.note ?? now.note, products: now.products,
      }, current.restrictions?.minimum_amount ?? null);
      // A start date kept as-is keeps its exact time.
      if (input.starts_on === undefined) rules.startsAt = now.startsAt;
      await s.promotionCodes.update(promoId, { metadata: rulesToMetadata(rules) });
      await adminAudit(ctx.supabase, "billing.promo.update", { type: "promo", id: promoId }, { code: current.code, ...rules, via: "mcp" });
      return { targetId: promoId, data: { updated: current.code, rules } };
    } catch (e) {
      if (e instanceof ToolError) throw e;
      throw stripeError(e);
    }
  });

  defineTool(server, ctx, "billing_promo_set_active", {
    ...base, risk: "write", title: "Turn a promo code on or off",
    description: "Turn a promo code (id promo_...) on or off. Off stops it being used right away.",
    inputSchema: z.object({ id: z.string().regex(/^promo_[A-Za-z0-9]+$/), active: z.boolean() }),
  }, async ({ id: promoId, active }) => {
    need(perms, "billing.manage");
    const s = await stripeOrFail();
    try { await s.promotionCodes.update(promoId, { active }); } catch (e) { throw stripeError(e); }
    await adminAudit(ctx.supabase, active ? "billing.promo.enable" : "billing.promo.disable", { type: "promo", id: promoId }, { via: "mcp" });
    return { targetId: promoId, data: { id: promoId, active } };
  });

  defineTool(server, ctx, "billing_refund_prepare", {
    ...base, risk: "high", previewOnly: true, title: "Refund an order",
    description: "Refund an order's card payment in full through Stripe. Nothing happens yet: this returns a preview and a confirmation_id. Show the person the order and amount; only after a clear yes call confirm_action.",
    inputSchema: z.object({ order_id: id("Order"), reason: z.string().trim().max(200).default("") }),
  }, async ({ order_id, reason }) => {
    need(perms, "billing.manage");
    const { data, error } = await ctx.supabase.from("orders").select("id, number, email, total, currency, status, stripe_payment_intent_id").eq("id", order_id).maybeSingle();
    check(error);
    const o = found(data, "Order");
    if (!o.stripe_payment_intent_id) throw new ToolError("This order has no card payment to refund here. Refund it in the Stripe dashboard.");
    if (!["paid", "partially_refunded"].includes(o.status)) throw new ToolError(`Order #${o.number} is ${o.status.replace("_", " ")}, so it can't be refunded.`);
    return prepare(ctx, "billing_refund", { order_id, reason }, `Refund order #${o.number} (${(o.total / 100).toFixed(2)} ${o.currency.toUpperCase()}) to ${o.email ?? "the customer"}`, o);
  });

  defineTool(server, ctx, "billing_settings_get", {
    ...base, risk: "read", title: "Get billing settings",
    description: "Free monthly minutes without a plan, the own-AI-keys discount percent, whether usage limits are enforced, and free Redial screening minutes.",
    inputSchema: z.object({}),
  }, async () => ({ data: { settings: await getBillingSettings(ctx.supabase) } }));

  defineTool(server, ctx, "billing_settings_set", {
    ...base, risk: "write", title: "Change billing settings",
    description: "Change billing settings; only pass what changes. freeMinutes (0-1,000,000), byokDiscountPercent (0-90), enforceLimits, redialFreeMinutes (0-100,000).",
    inputSchema: z.object({
      freeMinutes: z.number().int().min(0).max(1_000_000).optional(), byokDiscountPercent: z.number().int().min(0).max(90).optional(),
      enforceLimits: z.boolean().optional(), redialFreeMinutes: z.number().int().min(0).max(100_000).optional(),
    }),
  }, async (input) => {
    need(perms, "billing.manage");
    const before = await getBillingSettings(ctx.supabase);
    const next = parseBillingSettings({ ...before, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) });
    const { error } = await ctx.supabase.from("platform_settings").upsert({ key: "billing", value: next }, { onConflict: "key" });
    check(error);
    await adminAudit(ctx.supabase, "billing.settings.save", { type: "setting", id: "billing" }, { from: before, to: next, via: "mcp" });
    return { data: { settings: next } };
  });
}
