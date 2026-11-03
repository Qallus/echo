"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { refundOrder } from "@/lib/admin/actions/billing";
import { money } from "@/lib/billing/catalog";

export type OrderRow = { id: string; number: number; user_id: string; user_email: string | null; status: string; kind: string; total: number; currency: string; items: string | null; created_at: string; refundable: boolean; receipt_url: string | null };

export function OrdersTable({ orders, canRefund }: { orders: OrderRow[]; canRefund: boolean }) {
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? orders.filter((o) => `${o.number} ${o.user_email ?? ""} ${o.items ?? ""}`.toLowerCase().includes(q)) : orders;
  }, [orders, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order number, email or item" className="pl-8" aria-label="Search orders" />
      </div>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
      {shown.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No orders yet.</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Date</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {shown.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">#{o.number}{o.kind === "renewal" && <span className="text-xs text-muted-foreground"> renewal</span>}</TableCell>
                <TableCell><Link href={`/admin/users/${o.user_id}`} className="hover:underline">{o.user_email ?? "—"}</Link></TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{o.items ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className={o.status.includes("refund") ? "text-destructive" : ""}>{o.status.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{money(o.total, o.currency)}</TableCell>
                <TableCell className="text-muted-foreground"><LocalDate iso={o.created_at} short /></TableCell>
                <TableCell className="text-right">
                  {o.receipt_url && <a href={o.receipt_url} target="_blank" rel="noreferrer" className="mr-2 text-xs text-muted-foreground hover:text-foreground">Receipt</a>}
                  {canRefund && o.refundable && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => {
                      const reason = prompt(`Refund order #${o.number} (${money(o.total, o.currency)}) in full?\n\nReason (kept in the audit log):`);
                      if (reason !== null) start(async () => setMsg(await refundOrder(o.id, reason)));
                    }}>Refund</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
