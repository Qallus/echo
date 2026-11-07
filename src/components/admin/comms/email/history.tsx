"use client";

import { useState } from "react";
import { AlertTriangle, Bot, CheckCheck, Eye, MousePointerClick } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Campaign, Send, Template } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { Pick } from "./pick";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");

const FILTERS = [
  { value: "all", label: "All" }, { value: "sent", label: "Sent" }, { value: "delivered", label: "Delivered" }, { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" }, { value: "bounced", label: "Bounced or spam" }, { value: "test", label: "Test" },
  { value: "skipped", label: "Skipped" }, { value: "failed", label: "Failed" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];
const matches = (s: Send, f: Filter) =>
  f === "all" ? true : f === "delivered" ? !!s.delivered_at : f === "opened" ? !!s.opened_at : f === "clicked" ? !!s.clicked_at
    : f === "bounced" ? !!(s.bounced_at || s.complained_at) : s.status === f;

// What happened after an email left: delivered, opened, clicked, bounced or
// marked as spam (from Resend's events).
function Tracking({ s }: { s: Send }) {
  if (s.complained_at) return <Badge variant="outline" className="gap-1 text-destructive" title={`Marked as spam ${when(s.complained_at)}`}><AlertTriangle className="size-3" />Spam</Badge>;
  if (s.bounced_at) return <Badge variant="outline" className="gap-1 text-destructive" title={`Bounced ${when(s.bounced_at)}`}><AlertTriangle className="size-3" />Bounced</Badge>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {s.delivered_at && <Badge variant="outline" className="gap-1" title={`Delivered ${when(s.delivered_at)}`}><CheckCheck className="size-3" />Delivered</Badge>}
      {s.opened_at && <Badge variant="outline" className="gap-1" title={`First opened ${when(s.opened_at)}`}><Eye className="size-3" />Opened{s.open_count > 1 ? ` ×${s.open_count}` : ""}</Badge>}
      {s.clicked_at && <Badge variant="outline" className="gap-1" title={`First click ${when(s.clicked_at)}`}><MousePointerClick className="size-3" />Clicked{s.click_count > 1 ? ` ×${s.click_count}` : ""}</Badge>}
      {s.last_event === "delayed" && !s.delivered_at && <Badge variant="outline" className="text-muted-foreground">Delayed, retrying</Badge>}
    </span>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", warn && "text-destructive")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function History({ sends, campaigns, templates }: { sends: Send[]; campaigns: Campaign[]; templates: Template[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const names = new Map(templates.map((t) => [t.id, t.name]));
  const shown = sends.filter((s) => matches(s, filter));
  const out = sends.filter((s) => s.status === "sent");
  const n = (fn: (s: Send) => unknown) => out.filter(fn).length;
  const delivered = n((s) => s.delivered_at), opened = n((s) => s.opened_at), clicked = n((s) => s.clicked_at), bounced = n((s) => s.bounced_at || s.complained_at);
  const tracking = sends.some((s) => s.last_event);

  return (
    <div className="space-y-4">
      {out.length > 0 && (
        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Delivered" value={pct(delivered, out.length)} sub={`${delivered.toLocaleString()} of ${out.length.toLocaleString()} sent`} />
            <Stat label="Opened" value={pct(opened, delivered || out.length)} sub={`${opened.toLocaleString()} people`} />
            <Stat label="Clicked" value={pct(clicked, delivered || out.length)} sub={`${clicked.toLocaleString()} people`} />
            <Stat label="Bounced or spam" value={pct(bounced, out.length)} sub={`${bounced.toLocaleString()} addresses, now skipped`} warn={bounced / out.length > 0.02} />
          </div>
          <p className="text-xs text-muted-foreground">
            The {sends.length.toLocaleString()} most recent emails.{" "}
            {tracking ? "Opens are estimates: some email apps block the tracking image, and some open every email automatically."
              : "Delivery, opens and clicks appear once the Resend webhook sends delivery events (see Settings → Integrations)."}
          </p>
        </section>
      )}

      {campaigns.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bulk sends</h3>
          <div className="rounded-xl border bg-card px-2">
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Subject</TableHead><TableHead>Audience</TableHead><TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead><TableHead className="text-right">Opened</TableHead><TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Bounced</TableHead><TableHead className="text-right">Skipped</TableHead><TableHead className="text-right">Failed</TableHead><TableHead>By</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const base = c.stats.delivered || c.sent;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{when(c.created_at)}</TableCell>
                      <TableCell className="max-w-64 truncate">{c.subject}<span className="block text-xs text-muted-foreground">{c.template_id ? names.get(c.template_id) ?? "Deleted template" : "Message"}</span></TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">{c.audience_label}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.sent.toLocaleString()}<span className="text-muted-foreground"> / {c.total.toLocaleString()}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{c.stats.delivered.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(c.stats.opened, base)}<span className="block text-xs text-muted-foreground">{c.stats.opened.toLocaleString()}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{pct(c.stats.clicked, base)}<span className="block text-xs text-muted-foreground">{c.stats.clicked.toLocaleString()}</span></TableCell>
                      <TableCell className={cn("text-right tabular-nums", (c.stats.bounced || c.stats.complained) && "text-destructive")}>{c.stats.bounced + c.stats.complained}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{c.skipped}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", c.failed && "text-destructive")}>{c.failed}</TableCell>
                      <TableCell>{c.via === "claude" ? <span className="flex items-center gap-1 text-xs"><Bot className="size-3" />Claude</span> : <span className="text-xs text-muted-foreground">Admin</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Every email</h3>
          <Pick label="Show" className="ml-auto w-44" value={filter} onChange={setFilter} options={FILTERS} />
        </div>
        {shown.length === 0 ? <EmptyState message="Nothing here yet." /> : (
          <div className="rounded-xl border bg-card px-2">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>To</TableHead><TableHead>Subject</TableHead><TableHead>Template</TableHead><TableHead>Status</TableHead><TableHead>Tracking</TableHead></TableRow></TableHeader>
              <TableBody>
                {shown.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when(s.created_at)}</TableCell>
                    <TableCell>{s.to_email}</TableCell>
                    <TableCell className="max-w-64 truncate">{s.subject}</TableCell>
                    <TableCell className="text-muted-foreground">{s.template_id ? names.get(s.template_id) ?? "Deleted" : "Message"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(s.status === "failed" && "text-destructive", s.status === "skipped" && "text-muted-foreground")}>{s.status}</Badge>
                      {s.error && <span className="ml-2 text-xs text-muted-foreground">{s.error}</span>}
                    </TableCell>
                    <TableCell><Tracking s={s} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
