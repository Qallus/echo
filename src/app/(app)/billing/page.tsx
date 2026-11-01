import Link from "next/link";
import { CreditCard, Receipt, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/billing/status-badge";
import { LocalDate } from "@/components/local-date";
import { listOrders, listRecordings, listSubscriptions, requireUser } from "@/lib/data";
import { openBillingPortal } from "@/lib/billing/actions";
import { findPrice, money } from "@/lib/billing/catalog";
import { formatDuration } from "@/lib/format";

export const metadata = { title: "Billing · Echo" };

const ACTIVE = ["active", "trialing", "past_due"];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ portal?: string }> }) {
  const user = await requireUser();
  const [{ portal }, subs, orders, recordings] = await Promise.all([searchParams, listSubscriptions(), listOrders(5), listRecordings()]);

  const active = subs.filter((s) => ACTIVE.includes(s.status));
  const lines = active.flatMap((s) => s.items.map((i) => ({ ...i, sub: s, hit: i.price_key ? findPrice(i.price_key) : null })));
  const plan = lines.find((l) => l.hit?.product.kind === "plan");
  const boltOns = lines.filter((l) => l.hit?.product.kind === "bolt_on");

  const mine = recordings.filter((r) => r.createdBy === user.id && !r.deletedAt);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonth = mine.filter((r) => new Date(r.createdAt) >= monthStart);
  const stats = [
    { label: "Recordings this month", value: thisMonth.length },
    { label: "Recorded this month", value: formatDuration(thisMonth.reduce((n, r) => n + r.durationSec, 0)) },
    { label: "Recordings in total", value: mine.length },
    { label: "Recorded in total", value: formatDuration(mine.reduce((n, r) => n + r.durationSec, 0)) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
      {portal === "unavailable" && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">Billing management opens after your first purchase.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <CreditCard className="size-4" /> Plan
            <Badge variant="outline">{plan?.hit ? `${plan.hit.product.name}${plan.hit.product.perSeat ? ` · ${plan.quantity} seats` : ""}` : "Free"}</Badge>
            {plan?.sub.status === "past_due" && <Badge variant="outline" className="text-destructive">Payment due</Badge>}
          </CardTitle>
          <CardDescription>
            {plan?.hit
              ? <>Billed {plan.hit.price.interval === "year" ? "annually" : "monthly"}. {plan.sub.currentPeriodEnd && <>{plan.sub.cancelAtPeriodEnd ? "Ends" : "Renews"} on <LocalDate iso={plan.sub.currentPeriodEnd} short />.</>}</>
              : "You're on the free plan. Upgrade for more minutes, a shared Business workspace and bolt-ons."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {boltOns.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Bolt-ons</p>
              <ul className="flex flex-wrap gap-2">{boltOns.map((b) => <li key={b.price_key}><Badge variant="outline">{b.hit!.product.name}</Badge></li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/pricing" />}><ShoppingCart /> {plan ? "Add bolt-ons or packs" : "See plans"}</Button>
            <form action={openBillingPortal}><Button type="submit" variant="outline">Manage billing</Button></form>
          </div>
          <p className="text-xs text-muted-foreground">Manage billing opens Stripe: change plan or seats, update your card, download invoices or cancel.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="size-4" /> Recent orders</CardTitle>
          <CardDescription><Link href="/orders" className="underline">All orders and receipts</Link></CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
            <ul className="divide-y rounded-lg border">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                    <span className="flex-1">#{o.number} · <LocalDate iso={o.createdAt} short /></span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-20 text-right tabular-nums">{money(o.total, o.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your usage</CardTitle>
          <CardDescription>Recordings you made, in every workspace (Trash not counted).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
