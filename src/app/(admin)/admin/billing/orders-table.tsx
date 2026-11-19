"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, ExternalLink, ReceiptText, Undo2, UserRound } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { downloadCsv } from "@/components/admin/list-csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { refundOrder } from "@/lib/admin/actions/billing";
import { money } from "@/lib/billing/catalog";

export type OrderRow = { id: string; number: number; user_id: string; user_email: string | null; status: string; kind: string; total: number; currency: string; items: string | null; created_at: string; refundable: boolean; receipt_url: string | null };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const status = (o: OrderRow) => <Badge variant="outline" className={o.status.includes("refund") ? "text-destructive" : ""}>{o.status.replace("_", " ")}</Badge>;
const icon = () => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><ReceiptText className="size-4" /></span>;

// Admin → Billing → Orders: every order in the shared list layout. Refunds
// are one order at a time from its preview, with a reason for the audit log.
export function OrdersTable({ orders, canRefund }: { orders: OrderRow[]; canRefund: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const refund = (o: OrderRow) => {
    const reason = prompt(`Refund order #${o.number} (${money(o.total, o.currency)}) in full?\n\nReason (kept in the audit log):`);
    if (reason !== null) start(async () => { setMsg(await refundOrder(o.id, reason)); router.refresh(); });
  };

  return (
    <div className="space-y-3">
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
      <CollectionView<OrderRow>
        items={orders} getId={(o) => o.id} title={(o) => `Order #${o.number}`} subtitle={(o) => o.user_email ?? "—"} media={icon} badge={status}
        noun={["order", "orders"]} storageKey="admin-billing-orders" defaultView="table" empty="No orders yet."
        meta={(o) => <>{money(o.total, o.currency)} · {when(o.created_at)}{o.items ? ` · ${o.items}` : ""}</>}
        searchText={(o) => `${o.number} ${o.user_email ?? ""} ${o.items ?? ""} ${o.status}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "paid", label: "Paid", test: (o) => o.status === "paid" },
          { id: "refunded", label: "Refunded", test: (o) => o.status.includes("refund") },
          { id: "renewal", label: "Renewals", test: (o) => o.kind === "renewal" },
        ]}
        date={(o) => o.created_at}
        columns={[
          { id: "order", label: "Order", sort: (o) => o.number, cell: (o) => <span className="font-medium">#{o.number}{o.kind === "renewal" && <span className="text-xs font-normal text-muted-foreground"> renewal</span>}</span> },
          { id: "customer", label: "Customer", sort: (o) => o.user_email, cell: (o) => <span className="text-muted-foreground">{o.user_email ?? "—"}</span> },
          { id: "items", label: "Items", cell: (o) => <span className="block max-w-xs truncate text-muted-foreground">{o.items ?? "—"}</span> },
          { id: "status", label: "Status", sort: (o) => o.status, cell: status },
          { id: "total", label: "Total", sort: (o) => o.total, className: "text-right tabular-nums", cell: (o) => money(o.total, o.currency) },
          { id: "date", label: "Date", sort: (o) => o.created_at, cell: (o) => <span className="text-muted-foreground">{when(o.created_at)}</span> },
        ]}
        actions={[
          { label: "Customer", icon: UserRound, single: true, run: ([o]) => router.push(`/admin/users/${o.user_id}`) },
          { label: "Export", icon: Download, run: (rows) => downloadCsv("orders.csv", ["Order", "Customer", "Items", "Status", "Total", "Currency", "Date"],
            rows.map((o) => [o.number, o.user_email, o.items, o.status, (o.total / 100).toFixed(2), o.currency, o.created_at])) },
        ]}
        previewActions={(o) => canRefund && o.refundable ? <Button size="sm" variant="outline" disabled={pending} onClick={() => refund(o)}><Undo2 /> Refund</Button> : null}
        preview={(o) => (
          <div className="space-y-4 text-sm">
            <dl className="divide-y rounded-xl border px-3">
              {[["Customer", <Link key="c" href={`/admin/users/${o.user_id}`} className="hover:underline">{o.user_email ?? "—"}</Link>], ["Items", o.items ?? "—"],
                ["Total", money(o.total, o.currency)], ["Status", o.status.replace("_", " ")], ["Kind", o.kind === "renewal" ? "Renewal" : "Purchase"], ["Date", when(o.created_at)]].map(([k, v]) => (
                <div key={String(k)} className="grid grid-cols-[6rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
              ))}
            </dl>
            {o.receipt_url && <a href={o.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">Stripe receipt <ExternalLink className="size-3.5" /></a>}
          </div>
        )}
      />
    </div>
  );
}
