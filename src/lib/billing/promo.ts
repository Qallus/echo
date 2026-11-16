import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { discountLabel, promoStatus, rulesFromMetadata, showDay, type PromoRow } from "./promo-rules";

// Reads Stripe promotion codes into Echo's shape and checks a code against a
// cart. Stripe re-checks its own rules when the checkout session is created.

const iso = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : null);

export function toPromoRow(p: Stripe.PromotionCode): Omit<PromoRow, "given" | "orders"> {
  const c = typeof p.promotion?.coupon === "object" ? p.promotion.coupon : null;
  return {
    ...rulesFromMetadata(p.metadata),
    id: p.id,
    code: p.code,
    name: c?.name ?? p.code,
    active: p.active,
    percentOff: c?.percent_off ?? null,
    amountOff: c?.amount_off ?? null,
    duration: (c?.duration ?? "once") as PromoRow["duration"],
    months: c?.duration_in_months ?? null,
    expiresAt: iso(p.expires_at),
    maxUses: p.max_redemptions ?? null,
    used: p.times_redeemed,
    minOrder: p.restrictions?.minimum_amount ?? null,
    firstTimeOnly: Boolean(p.restrictions?.first_time_transaction),
    created: iso(p.created)!,
  };
}

export async function findPromo(s: Stripe, code: string) {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(clean)) return null;
  const list = await s.promotionCodes.list({ code: clean, limit: 1, expand: ["data.promotion.coupon"] });
  return list.data[0] ? toPromoRow(list.data[0]) : null;
}

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export type PromoCheck =
  | { ok: true; id: string; code: string; label: string; discount: number }
  | { ok: false; error: string };

// items: the cart's lines with their catalog product and amount (cents).
export async function checkPromo(s: Stripe, supabase: SupabaseClient, code: string, user: { id: string; email?: string | null } | null,
  items: { productId: string; amount: number }[]): Promise<PromoCheck> {
  const p = await findPromo(s, code);
  const fail = (error: string): PromoCheck => ({ ok: false, error });
  if (!p) return fail("That code isn't valid.");

  const status = promoStatus(p);
  if (status === "off") return fail("That code isn't valid.");
  if (status === "expired") return fail("That code has expired.");
  if (status === "used_up") return fail("That code has been fully used.");
  if (status === "scheduled") return fail(`That code starts on ${showDay(p.startsAt)}.`);

  const subtotal = items.reduce((n, i) => n + i.amount, 0);
  if (p.minOrder != null && subtotal < p.minOrder) return fail(`That code needs an order of ${usd(p.minOrder)} or more.`);
  if (p.maxOrder != null && subtotal > p.maxOrder) return fail(`That code works on orders up to ${usd(p.maxOrder)}.`);

  const eligible = p.products.length ? items.filter((i) => p.products.includes(i.productId)) : items;
  const base = eligible.reduce((n, i) => n + i.amount, 0);
  if (!eligible.length || base <= 0) return fail("That code doesn't apply to anything in your cart.");

  if (user) {
    if (p.email && p.email.toLowerCase() !== (user.email ?? "").toLowerCase()) return fail("That code is for a different account.");
    if (p.perCustomer != null || p.firstTimeOnly) {
      const { data } = await supabase.from("orders").select("promo_code_id").eq("user_id", user.id).eq("kind", "checkout").in("status", ["paid", "partially_refunded"]).limit(500);
      const rows = data ?? [];
      if (p.firstTimeOnly && rows.length) return fail("That code is for first-time customers.");
      const mine = rows.filter((r) => r.promo_code_id === p.id).length;
      if (p.perCustomer != null && mine >= p.perCustomer) return fail(p.perCustomer === 1 ? "You've already used that code." : `You've used that code the maximum ${p.perCustomer} times.`);
    }
  }

  const discount = p.percentOff ? Math.round((base * p.percentOff) / 100) : Math.min(p.amountOff ?? 0, base);
  return { ok: true, id: p.id, code: p.code, label: `${p.name}: ${discountLabel(p)}`, discount };
}
