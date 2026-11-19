"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BellRing, ExternalLink, Mail, MessageSquare, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import type { Delivery } from "@/lib/comms/data";
import { cn } from "@/lib/utils";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ICON = { email: Mail, sms: MessageSquare, push: Smartphone } as Record<string, typeof Mail>;
const status = (d: Delivery) => <Badge variant="outline" className={cn("capitalize", d.status === "failed" && "text-destructive")}>{d.status}</Badge>;
const event = (d: Delivery) => d.notification?.type.replaceAll("_", " ") ?? "—";

// Every email, text and push Redial tried to deliver for a notification, and
// how it went (the last 300).
export function NotificationsPanel({ deliveries }: { deliveries: Delivery[] }) {
  const counts = useMemo(() => ({
    sent: deliveries.filter((d) => d.status === "sent").length,
    failed: deliveries.filter((d) => d.status === "failed").length,
    skipped: deliveries.filter((d) => d.status === "skipped").length,
  }), [deliveries]);
  const icon = (d: Delivery) => <IconTile icon={ICON[d.channel] ?? BellRing} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{counts.sent} sent · <span className={cn(counts.failed && "text-destructive")}>{counts.failed} failed</span> · {counts.skipped} skipped (preferences, quiet hours or no channel), last 300.</p>
      <CollectionView<Delivery>
        items={deliveries} getId={(d) => d.id} title={(d) => d.notification?.title ?? "Notification"} noun={["delivery", "deliveries"]} storageKey="admin-notifications"
        subtitle={(d) => `${event(d)} · ${d.channel === "push" ? "Browser or device" : d.target}`} media={icon} badge={status} meta={(d) => when(d.created_at)}
        searchText={(d) => `${d.notification?.title ?? ""} ${d.notification?.type ?? ""} ${d.target ?? ""} ${d.channel} ${d.status} ${d.detail ?? ""}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "failed", label: "Failed", test: (d) => d.status === "failed" },
          { id: "sent", label: "Sent", test: (d) => d.status === "sent" },
          { id: "skipped", label: "Skipped", test: (d) => d.status === "skipped" },
          { id: "email", label: "Email", test: (d) => d.channel === "email" },
          { id: "sms", label: "Text", test: (d) => d.channel === "sms" },
          { id: "push", label: "Push", test: (d) => d.channel === "push" },
        ]}
        date={(d) => d.created_at}
        columns={[
          { id: "when", label: "When", sort: (d) => d.created_at, cell: (d) => <span className="whitespace-nowrap text-muted-foreground">{when(d.created_at)}</span> },
          { id: "title", label: "Notification", sort: (d) => d.notification?.title ?? null, cell: (d) => <span className="font-medium">{d.notification?.title ?? "—"}</span> },
          { id: "event", label: "Event", sort: (d) => d.notification?.type ?? null, cell: (d) => muted(event(d)) },
          { id: "channel", label: "Channel", sort: (d) => d.channel, cell: (d) => <Badge variant="outline">{d.channel}</Badge> },
          { id: "to", label: "To", sort: (d) => d.target, cell: (d) => muted(d.channel === "push" ? "Browser or device" : d.target) },
          { id: "status", label: "Status", sort: (d) => d.status, cell: status },
          { id: "detail", label: "Detail", cell: (d) => <span className="text-xs text-muted-foreground">{d.detail ?? "—"}</span> },
        ]}
        previewActions={(d) => d.notification && (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/users/${d.notification.user_id}`} />}><ExternalLink /> Customer</Button>
        )}
        preview={(d) => (
          <DetailList rows={[
            ["Event", event(d)], ["Channel", d.channel], ["To", d.channel === "push" ? "Browser or device" : d.target ?? "—"],
            ["Status", status(d)], ["When", when(d.created_at)], ["Detail", d.detail ?? "—"],
          ]} />
        )}
      />
    </div>
  );
}
