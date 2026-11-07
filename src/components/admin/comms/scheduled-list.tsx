"use client";

import { useState, useTransition } from "react";
import { Bot, CalendarClock, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelScheduled } from "@/lib/admin/actions/comms";
import type { Scheduled } from "@/lib/comms/data";
import { SMS_KINDS, isSmsKind } from "@/lib/comms/sms-kinds";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const STATUS: Record<Scheduled["status"], string> = { scheduled: "Scheduled", sending: "Sending", sent: "Sent", partial: "Partly sent", failed: "Failed", canceled: "Canceled" };

// Scheduled email or text sends: upcoming ones can be canceled; finished ones
// show what happened.
export function ScheduledList({ items, readOnly, empty }: { items: Scheduled[]; readOnly: boolean; empty: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  if (!items.length) return <EmptyState message={empty} />;
  const upcoming = items.filter((x) => x.status === "scheduled" || x.status === "sending").sort((a, b) => a.send_at.localeCompare(b.send_at));
  const past = items.filter((x) => !upcoming.includes(x));

  const row = (x: Scheduled) => {
    const Icon = x.channel === "email" ? Mail : MessageSquare;
    const kind = isSmsKind(x.content?.kind) ? SMS_KINDS[x.content.kind].label : null;
    return (
      <li key={x.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{x.subject || "(no subject)"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {x.label}{kind ? ` · ${kind}` : ""} · {x.total.toLocaleString()} {x.total === 1 ? "person" : "people"}
            {x.via === "claude" && <span className="ml-1 inline-flex items-center gap-0.5"><Bot className="size-3" />Claude</span>}
          </p>
          {x.status === "sending" && x.channel === "sms" && <p className="text-xs text-muted-foreground">{x.progress.toLocaleString()} of {x.total.toLocaleString()} done</p>}
          {(x.status === "sent" || x.status === "partial" || x.status === "failed") && (
            <p className="text-xs text-muted-foreground">{x.sent.toLocaleString()} sent{x.skipped ? ` · ${x.skipped.toLocaleString()} skipped` : ""}{x.failed ? ` · ${x.failed.toLocaleString()} failed` : ""}</p>
          )}
          {x.error && <p className="text-xs text-destructive">{x.error}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-xs whitespace-nowrap"><CalendarClock className="size-3.5" />{when(x.send_at)}</span>
          <Badge variant="outline" className={cn(x.status === "failed" && "text-destructive", x.status === "canceled" && "text-muted-foreground", x.status === "scheduled" && "border-primary/40")}>{STATUS[x.status]}</Badge>
          {x.status === "scheduled" && !readOnly && (
            <Button size="xs" variant="ghost" disabled={pending} onClick={() => confirm("Cancel this scheduled send?") && start(async () => setMsg(await cancelScheduled(x.id)))}>Cancel</Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {(msg.ok || msg.error) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{msg.error ?? msg.ok}</p>}
      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Upcoming</h3>
          <ul className="divide-y rounded-xl border bg-card">{upcoming.map(row)}</ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Earlier</h3>
          <ul className="divide-y rounded-xl border bg-card">{past.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
