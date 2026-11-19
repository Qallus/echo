"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Receipt } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { OrderStatusBadge } from "@/components/billing/status-badge";
import { LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/billing/catalog";
import type { Order } from "@/lib/data";

// Your orders in the shared list layout. A click previews the receipt;
// "Open receipt" goes to the full page at /orders/[id].

const items = (o: Order) => o.items.map((i) => i.description).join(", ") || "—";
const icon = () => <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Receipt className="size-4" /></span>;

export function OrdersList({ orders }: { orders: Order[] }) {
  const router = useRouter();
  return (
    <CollectionView<Order>
      items={orders} getId={(o) => o.id} noun={["order", "orders"]} storageKey="orders" defaultView="list"
      empty="No orders yet. When you buy a plan, bolt-on or pack, the receipt shows up here."
      title={(o) => `Order #${o.number}${o.kind === "renewal" ? " · renewal" : ""}`}
      subtitle={items} media={icon}
      badge={(o) => <OrderStatusBadge status={o.status} />}
      meta={(o) => <span className="flex items-center gap-3"><LocalDate iso={o.createdAt} short /><span className="font-semibold text-foreground tabular-nums">{money(o.total, o.currency)}</span></span>}
      searchText={(o) => `${o.number} ${items(o)} ${o.status} ${o.kind} ${o.email ?? ""}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "paid", label: "Paid", test: (o) => o.status === "paid" },
        { id: "renewal", label: "Renewals", test: (o) => o.kind === "renewal" },
        { id: "refunded", label: "Refunded", test: (o) => o.status.includes("refund") },
        { id: "other", label: "Open or failed", test: (o) => o.status !== "paid" && !o.status.includes("refund") },
      ]}
      date={(o) => o.createdAt}
      columns={[
        { id: "number", label: "Order", sort: (o) => o.number, cell: (o) => <span className="font-medium">#{o.number}</span> },
        { id: "items", label: "Items", sort: (o) => items(o).toLowerCase(), cell: (o) => <span className="line-clamp-1 text-muted-foreground">{items(o)}</span> },
        { id: "kind", label: "Type", sort: (o) => o.kind, cell: (o) => <span className="capitalize text-muted-foreground">{o.kind}</span> },
        { id: "status", label: "Status", sort: (o) => o.status, cell: (o) => <OrderStatusBadge status={o.status} /> },
        { id: "total", label: "Total", sort: (o) => o.total, className: "text-right", cell: (o) => <span className="font-semibold tabular-nums">{money(o.total, o.currency)}</span> },
        { id: "date", label: "Date", sort: (o) => o.createdAt, cell: (o) => <span className="text-muted-foreground"><LocalDate iso={o.createdAt} short /></span> },
      ]}
      actions={[
        { label: "Open receipt", icon: ExternalLink, single: true, run: ([o]) => router.push(`/orders/${o.id}`) },
        { label: "Invoice PDF", icon: Download, single: true, show: ([o]) => Boolean(o?.invoicePdf), run: ([o]) => { if (o.invoicePdf) window.open(o.invoicePdf, "_blank", "noopener"); } },
      ]}
      previewActions={(o) => (
        <>
          <Button size="sm" nativeButton={false} render={<Link href={`/orders/${o.id}`} />}><ExternalLink /> Open receipt</Button>
          {o.invoicePdf && <Button size="sm" variant="outline" nativeButton={false} render={<a href={o.invoicePdf} target="_blank" rel="noopener noreferrer" />}><Download /> Invoice PDF</Button>}
        </>
      )}
      preview={(o) => (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <OrderStatusBadge status={o.status} /><span className="capitalize">{o.kind}</span><span>·</span><LocalDate iso={o.createdAt} />
          </div>
          <ul className="divide-y rounded-xl border">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium">{i.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.quantity > 1 ? `${i.quantity} × ${i.unitAmount != null ? money(i.unitAmount, o.currency) : ""}` : null}
                    {i.interval ? `${i.quantity > 1 ? " · " : ""}per ${i.interval}` : null}
                  </p>
                </div>
                <span className="tabular-nums">{money(i.amount, o.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 rounded-xl border px-3 py-2.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(o.subtotal, o.currency)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{money(o.discount, o.currency)}</dd></div>}
            {o.tax > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(o.tax, o.currency)}</dd></div>}
            <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(o.total, o.currency)}</dd></div>
          </dl>
          {o.email && <p className="text-xs text-muted-foreground">Receipt sent to {o.email}</p>}
          {o.receiptUrl && <a href={o.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">Payment receipt from Stripe</a>}
        </div>
      )}
    />
  );
}
