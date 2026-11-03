"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Delivery } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { DataTable, plain, type Column } from "@/components/admin/crm/data-table";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Every email, text and push Echo tried to deliver for a notification, and
// how it went. Failures first in the counts; filter by channel or status.
export function NotificationsPanel({ deliveries }: { deliveries: Delivery[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const counts = useMemo(() => ({
    sent: deliveries.filter((d) => d.status === "sent").length,
    failed: deliveries.filter((d) => d.status === "failed").length,
    skipped: deliveries.filter((d) => d.status === "skipped").length,
  }), [deliveries]);
  const columns: Column<Delivery>[] = [
    { id: "when", label: "When", cell: (d) => <span className="whitespace-nowrap text-muted-foreground">{when(d.created_at)}</span>, value: (d) => d.created_at },
    { id: "type", label: "Event", cell: (d) => plain(d.notification?.type.replaceAll("_", " ")), value: (d) => d.notification?.type ?? null, filter: true },
    { id: "title", label: "Notification", cell: (d) => plain(d.notification?.title), value: (d) => d.notification?.title ?? null },
    { id: "channel", label: "Channel", cell: (d) => <Badge variant="outline">{d.channel}</Badge>, value: (d) => d.channel, filter: true },
    { id: "target", label: "To", cell: (d) => plain(d.channel === "push" ? "Browser or device" : d.target), value: (d) => d.target },
    { id: "status", label: "Status", cell: (d) => <Badge variant="outline" className={cn(d.status === "failed" && "text-destructive")}>{d.status}</Badge>, value: (d) => d.status, filter: true },
    { id: "detail", label: "Detail", cell: (d) => <span className="text-xs text-muted-foreground" title={d.detail ?? undefined}>{d.detail ?? "—"}</span>, value: (d) => d.detail },
    { id: "user", label: "Customer", cell: (d) => (d.notification ? <Link href={`/admin/users/${d.notification.user_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>Open</Link> : "—"), hidden: true },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{counts.sent} sent · <span className={cn(counts.failed && "text-destructive")}>{counts.failed} failed</span> · {counts.skipped} skipped (preferences, quiet hours or no channel), last 300.</p>
      <DataTable rows={deliveries} columns={columns} getId={(d) => d.id} selected={selected} onSelect={setSelected} onOpen={() => {}} />
    </div>
  );
}
