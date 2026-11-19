"use client";

import { AlertTriangle, Bot, CheckCheck, Copy, Eye, Mail, MousePointerClick, Send as SendIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile } from "@/components/collection/kit";
import type { Campaign, Send, Template } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";

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

const by = (via: string) => (via === "claude" ? <span className="flex items-center gap-1 text-xs"><Bot className="size-3" />Claude</span> : <span className="text-xs text-muted-foreground">Admin</span>);
const statusBadge = (s: Send) => <Badge variant="outline" className={cn(s.status === "failed" && "text-destructive", s.status === "skipped" && "text-muted-foreground")}>{s.status}</Badge>;

export function History({ sends, campaigns, templates }: { sends: Send[]; campaigns: Campaign[]; templates: Template[] }) {
  const names = new Map(templates.map((t) => [t.id, t.name]));
  const tplName = (id: string | null) => (id ? names.get(id) ?? "Deleted template" : "Message");
  const out = sends.filter((s) => s.status === "sent");
  const n = (fn: (s: Send) => unknown) => out.filter(fn).length;
  const delivered = n((s) => s.delivered_at), opened = n((s) => s.opened_at), clicked = n((s) => s.clicked_at), bounced = n((s) => s.bounced_at || s.complained_at);
  const tracking = sends.some((s) => s.last_event);
  const copy = (rows: Send[]) => { void navigator.clipboard.writeText([...new Set(rows.map((s) => s.to_email))].join(", ")); };

  return (
    <div className="space-y-6">
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
          <CollectionView<Campaign>
            items={campaigns} getId={(c) => c.id} title={(c) => c.subject} noun={["bulk send", "bulk sends"]} storageKey="admin-email-campaigns" defaultView="table"
            subtitle={(c) => `${tplName(c.template_id)} · ${c.audience_label ?? "—"}`} media={() => <IconTile icon={SendIcon} />}
            meta={(c) => `${c.sent.toLocaleString()} of ${c.total.toLocaleString()} sent · ${when(c.created_at)}`}
            searchText={(c) => `${c.subject} ${c.audience_label ?? ""} ${tplName(c.template_id)}`}
            filters={[
              { id: "all", label: "All", test: () => true },
              { id: "problems", label: "With problems", test: (c) => c.failed > 0 || c.stats.bounced + c.stats.complained > 0 },
              { id: "claude", label: "By Claude", test: (c) => c.via === "claude" },
            ]}
            date={(c) => c.created_at}
            columns={[
              { id: "when", label: "When", sort: (c) => c.created_at, cell: (c) => <span className="whitespace-nowrap text-muted-foreground">{when(c.created_at)}</span> },
              { id: "subject", label: "Subject", sort: (c) => c.subject.toLowerCase(), cell: (c) => <span className="block max-w-64 truncate">{c.subject}<span className="block text-xs text-muted-foreground">{tplName(c.template_id)}</span></span> },
              { id: "audience", label: "Audience", sort: (c) => c.audience_label, cell: (c) => <span className="block max-w-56 truncate text-muted-foreground">{c.audience_label}</span> },
              { id: "sent", label: "Sent", sort: (c) => c.sent, cell: (c) => <span className="tabular-nums">{c.sent.toLocaleString()}<span className="text-muted-foreground"> / {c.total.toLocaleString()}</span></span> },
              { id: "opened", label: "Opened", sort: (c) => c.stats.opened / (c.stats.delivered || c.sent || 1), cell: (c) => <span className="tabular-nums">{pct(c.stats.opened, c.stats.delivered || c.sent)}</span> },
              { id: "clicked", label: "Clicked", sort: (c) => c.stats.clicked / (c.stats.delivered || c.sent || 1), cell: (c) => <span className="tabular-nums">{pct(c.stats.clicked, c.stats.delivered || c.sent)}</span> },
              { id: "bounced", label: "Bounced", sort: (c) => c.stats.bounced + c.stats.complained, cell: (c) => <span className={cn("tabular-nums", (c.stats.bounced || c.stats.complained) && "text-destructive")}>{c.stats.bounced + c.stats.complained}</span> },
              { id: "failed", label: "Failed", sort: (c) => c.failed, cell: (c) => <span className={cn("tabular-nums", c.failed && "text-destructive")}>{c.failed}</span> },
              { id: "by", label: "By", sort: (c) => c.via, cell: (c) => by(c.via) },
            ]}
            preview={(c) => {
              const base = c.stats.delivered || c.sent;
              return (
                <DetailList rows={[
                  ["Template", tplName(c.template_id)], ["Audience", c.audience_label ?? "—"], ["When", when(c.created_at)],
                  ["Sent", `${c.sent.toLocaleString()} of ${c.total.toLocaleString()}`], ["Delivered", c.stats.delivered.toLocaleString()],
                  ["Opened", `${pct(c.stats.opened, base)} (${c.stats.opened.toLocaleString()})`], ["Clicked", `${pct(c.stats.clicked, base)} (${c.stats.clicked.toLocaleString()})`],
                  ["Bounced or spam", c.stats.bounced + c.stats.complained], ["Skipped", c.skipped], ["Failed", c.failed], ["By", c.via === "claude" ? "Claude" : "Admin"],
                ]} />
              );
            }}
          />
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Every email</h3>
        {sends.length === 0 ? <EmptyState message="Nothing here yet." /> : (
          <CollectionView<Send>
            items={sends} getId={(s) => s.id} title={(s) => s.subject} noun={["email", "emails"]} storageKey="admin-email-sends" defaultView="table"
            subtitle={(s) => `${s.to_email} · ${tplName(s.template_id)}`} media={() => <IconTile icon={Mail} />} badge={statusBadge} meta={(s) => when(s.created_at)}
            searchText={(s) => `${s.to_email} ${s.subject} ${tplName(s.template_id)} ${s.status} ${s.error ?? ""}`}
            filters={FILTERS.map((f) => ({ id: f.value, label: f.label, test: (s: Send) => matches(s, f.value) }))}
            date={(s) => s.created_at}
            columns={[
              { id: "when", label: "When", sort: (s) => s.created_at, cell: (s) => <span className="whitespace-nowrap text-muted-foreground">{when(s.created_at)}</span> },
              { id: "to", label: "To", sort: (s) => s.to_email, cell: (s) => s.to_email },
              { id: "subject", label: "Subject", sort: (s) => s.subject.toLowerCase(), cell: (s) => <span className="block max-w-64 truncate">{s.subject}</span> },
              { id: "template", label: "Template", sort: (s) => tplName(s.template_id), cell: (s) => <span className="text-muted-foreground">{tplName(s.template_id)}</span> },
              { id: "status", label: "Status", sort: (s) => s.status, cell: (s) => <>{statusBadge(s)}{s.error && <span className="ml-2 text-xs text-muted-foreground">{s.error}</span>}</> },
              { id: "tracking", label: "Tracking", cell: (s) => <Tracking s={s} /> },
            ]}
            actions={[{ label: "Copy addresses", icon: Copy, run: copy }]}
            preview={(s) => (
              <div className="space-y-3">
                <DetailList rows={[["To", s.to_email], ["Template", tplName(s.template_id)], ["When", when(s.created_at)], ["Status", statusBadge(s)], ["Error", s.error ?? "—"]]} />
                <Tracking s={s} />
              </div>
            )}
          />
        )}
      </section>
    </div>
  );
}
