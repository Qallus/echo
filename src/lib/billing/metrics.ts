import { amountFor, findPrice } from "./catalog";

export type SubLike = { status: string; items: { price_key: string; quantity: number }[] | null; updated_at?: string };

const LIVE = ["active", "trialing"];

// Monthly recurring revenue in cents from live subscriptions, priced from the
// catalog (annual prices count as a twelfth per month).
export function mrr(subs: SubLike[]): number {
  let cents = 0;
  for (const s of subs.filter((x) => LIVE.includes(x.status))) {
    for (const item of s.items ?? []) {
      const found = findPrice(item.price_key);
      if (!found?.price.interval) continue;
      const amount = amountFor(found.price, item.quantity ?? 1);
      cents += found.price.interval === "year" ? amount / 12 : amount;
    }
  }
  return Math.round(cents);
}

// Share of subscriptions that were live 30 days ago and have since cancelled
// (approximation from current status and last update).
export function churn30(subs: SubLike[]): number | null {
  const since = Date.now() - 30 * 86400_000;
  const cancelled = subs.filter((s) => (s.status === "canceled" || s.status === "incomplete_expired") && s.updated_at && Date.parse(s.updated_at) > since).length;
  const live = subs.filter((s) => LIVE.includes(s.status) || s.status === "past_due").length;
  return live + cancelled ? cancelled / (live + cancelled) : null;
}

// Paid order totals this calendar month and over the last 30 days, in cents.
export function revenue(orders: { status: string; total: number; created_at: string }[]) {
  const now = Date.now();
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const paid = orders.filter((x) => x.status === "paid" || x.status === "partially_refunded");
  const sum = (since: number) => paid.filter((x) => Date.parse(x.created_at) >= since).reduce((n, x) => n + x.total, 0);
  return { month: sum(monthStart), last30: sum(now - 30 * 86400_000) };
}
