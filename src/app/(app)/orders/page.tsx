import Link from "next/link";
import { Receipt } from "lucide-react";
import { OrderStatusBadge } from "@/components/billing/status-badge";
import { Button } from "@/components/ui/button";
import { LocalDate } from "@/components/local-date";
import { listOrders } from "@/lib/data";
import { money } from "@/lib/billing/catalog";

export const metadata = { title: "Orders · Echo" };

export default async function OrdersPage() {
  const orders = await listOrders();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Purchases and renewals, with receipts.</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/billing" />}>Billing &amp; plan</Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Receipt className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When you buy a plan, bolt-on or pack, the receipt shows up here.</p>
          <Button className="mt-6" nativeButton={false} render={<Link href="/pricing" />}>See plans</Button>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-muted/50 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Order #{o.number}{o.kind === "renewal" && <span className="font-normal text-muted-foreground"> · renewal</span>}</p>
                  <p className="truncate text-sm text-muted-foreground">{o.items.map((i) => i.description).join(", ") || "—"}</p>
                </div>
                <span className="text-sm text-muted-foreground"><LocalDate iso={o.createdAt} short /></span>
                <OrderStatusBadge status={o.status} />
                <span className="w-20 text-right font-semibold tabular-nums">{money(o.total, o.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
