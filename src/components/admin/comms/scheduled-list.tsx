"use client";

import { useState, useTransition } from "react";
import { Ban, Bot, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { cancelScheduled } from "@/lib/admin/actions/comms";
import type { Scheduled } from "@/lib/comms/data";
import { SMS_KINDS, isSmsKind } from "@/lib/comms/sms-kinds";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const STATUS: Record<Scheduled["status"], string> = { scheduled: "Scheduled", sending: "Sending", sent: "Sent", partial: "Partly sent", failed: "Failed", canceled: "Canceled" };
const isUpcoming = (x: Scheduled) => x.status === "scheduled" || x.status === "sending";
const people = (n: number) => `${n.toLocaleString()} ${n === 1 ? "person" : "people"}`;
const result = (x: Scheduled) => `${x.sent.toLocaleString()} sent${x.skipped ? ` · ${x.skipped.toLocaleString()} skipped` : ""}${x.failed ? ` · ${x.failed.toLocaleString()} failed` : ""}`;

// Scheduled email or text sends: upcoming ones can be canceled; finished ones
// show what happened.
export function ScheduledList({ items, readOnly, empty }: { items: Scheduled[]; readOnly: boolean; empty: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  if (!items.length) return <EmptyState message={empty} />;

  const badge = (x: Scheduled) => <Badge variant="outline" className={cn(x.status === "failed" && "text-destructive", x.status === "canceled" && "text-muted-foreground", x.status === "scheduled" && "border-primary/40")}>{STATUS[x.status]}</Badge>;
  const kind = (x: Scheduled) => (isSmsKind(x.content?.kind) ? SMS_KINDS[x.content.kind].label : null);
  const cancel = (list: Scheduled[]) => {
    const can = list.filter((x) => x.status === "scheduled");
    if (!can.length || !confirm(can.length === 1 ? "Cancel this scheduled send?" : `Cancel ${can.length} scheduled sends?`)) return;
    start(async () => {
      let last: { ok?: string; error?: string } = {};
      for (const x of can) { last = await cancelScheduled(x.id); if (last.error) break; }
      setMsg(last);
    });
  };

  return (
    <div className="space-y-4">
      {(msg.ok || msg.error) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{msg.error ?? msg.ok}</p>}
      <CollectionView<Scheduled>
        items={[...items].sort((a, b) => Number(isUpcoming(b)) - Number(isUpcoming(a)) || (isUpcoming(a) ? a.send_at.localeCompare(b.send_at) : b.send_at.localeCompare(a.send_at)))}
        getId={(x) => x.id} title={(x) => x.subject || "(no subject)"} noun={["send", "sends"]} storageKey="admin-scheduled" defaultView="list"
        subtitle={(x) => [x.label, kind(x), people(x.total)].filter(Boolean).join(" · ")}
        media={(x) => <IconTile icon={x.channel === "email" ? Mail : MessageSquare} />} badge={badge} meta={(x) => when(x.send_at)}
        searchText={(x) => `${x.subject ?? ""} ${x.label ?? ""} ${x.content?.body ?? ""} ${STATUS[x.status]}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "upcoming", label: "Upcoming", test: isUpcoming },
          { id: "done", label: "Finished", test: (x) => x.status === "sent" || x.status === "partial" },
          { id: "failed", label: "Failed", test: (x) => x.status === "failed" },
          { id: "canceled", label: "Canceled", test: (x) => x.status === "canceled" },
        ]}
        date={(x) => x.send_at}
        columns={[
          { id: "subject", label: "Send", sort: (x) => (x.subject ?? "").toLowerCase(), cell: (x) => <span className="font-medium">{x.subject || "(no subject)"}</span> },
          { id: "channel", label: "Channel", sort: (x) => x.channel, cell: (x) => muted(x.channel === "email" ? "Email" : "Text") },
          { id: "to", label: "To", sort: (x) => x.total, cell: (x) => muted(`${x.label ?? ""}${x.label ? " · " : ""}${people(x.total)}`) },
          { id: "when", label: "Send at", sort: (x) => x.send_at, cell: (x) => <span className="whitespace-nowrap text-muted-foreground">{when(x.send_at)}</span> },
          { id: "status", label: "Status", sort: (x) => x.status, cell: badge },
          { id: "result", label: "Result", cell: (x) => muted(x.status === "sending" && x.channel === "sms" ? `${x.progress.toLocaleString()} of ${x.total.toLocaleString()} done` : isUpcoming(x) ? "—" : result(x)) },
          { id: "via", label: "By", sort: (x) => x.via, cell: (x) => (x.via === "claude" ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Bot className="size-3.5" />Claude</span> : muted("Team")) },
        ]}
        actions={readOnly ? [] : [{ label: "Cancel send", icon: Ban, destructive: true, show: (rows) => rows.some((x) => x.status === "scheduled"), run: cancel }]}
        previewActions={(x) => !readOnly && x.status === "scheduled" && <Button size="sm" variant="outline" disabled={pending} onClick={() => cancel([x])}><Ban /> Cancel send</Button>}
        preview={(x) => (
          <div className="space-y-4">
            <DetailList rows={[
              ["Channel", x.channel === "email" ? "Email" : `Text${kind(x) ? ` · ${kind(x)}` : ""}`], ["To", `${x.label ?? "—"} · ${people(x.total)}`], ["Send at", when(x.send_at)],
              ["Status", badge(x)], ["Result", isUpcoming(x) ? "Not sent yet" : result(x)], ["By", x.via === "claude" ? "Claude" : "The team"],
            ]} />
            {x.error && <p className="text-sm text-destructive">{x.error}</p>}
            {x.content?.body && <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 text-sm">{x.content.body}</p>}
          </div>
        )}
      />
    </div>
  );
}
