import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { BarChart } from "@/components/admin/bar-chart";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import { CHANNELS, isChannel } from "@/lib/analytics/channels";
import type { Analytics } from "@/lib/analytics/report";

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");
const change = (now: number, before: number) => {
  if (!before) return now ? "new this period" : "no change";
  const d = (now - before) / before;
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(0)}% vs last period`;
};
export const channelLabel = (c: string) => (isChannel(c) ? CHANNELS[c] : c === "unknown" ? "Not tracked (before tracking or Google sign-up)" : c);

// The funnel and the channels that feed it.
export function OverviewTab({ a, prev, by }: { a: Analytics; prev: Analytics | null; by: string }) {
  const t = a.totals, p = prev?.totals;
  const steps = [
    { label: "Visitors", value: t.visitors }, { label: "Signed up", value: t.signups },
    { label: "Set up Redial", value: t.activated }, { label: "Paying", value: t.paying },
  ];
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-8">
      <StatRow>
        <StatTile label="Visitors" value={t.visitors.toLocaleString()} hint={p ? change(t.visitors, p.visitors) : `${t.views.toLocaleString()} page views`} />
        <StatTile label="Signups" value={t.signups.toLocaleString()} hint={`${pct(t.signups, t.visitors)} of visitors${p ? ` · ${change(t.signups, p.signups)}` : ""}`} />
        <StatTile label="Paying customers" value={t.paying.toLocaleString()} hint={`${pct(t.paying, t.signups)} of signups`} />
        <StatTile label="Revenue" value={(t.revenue_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          hint={p ? change(t.revenue_cents, p.revenue_cents) : undefined} accent />
      </StatRow>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">From visit to customer</h3>
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={s.label} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_8rem]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="h-5 overflow-hidden rounded-md bg-muted"><span className="block h-full rounded-md bg-primary/80" style={{ width: `${Math.max(2, (s.value / top) * 100)}%` }} /></span>
              <span className="text-right tabular-nums"><span className="font-medium">{s.value.toLocaleString()}</span>{i > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{pct(s.value, steps[i - 1].value)}</span>}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Visitors are counted without cookies. Signups, setup and paying count accounts created in this period.</p>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <BarChart title="Visitors (sessions)" unit="count" by="day" points={a.daily.map((d) => ({ bucket: d.day, value: d.sessions }))} />
        <BarChart title="Page views" unit="count" by="day" points={a.daily.map((d) => ({ bucket: d.day, value: d.views }))} />
        <BarChart title="Conversions" unit="count" by="day" points={a.daily.map((d) => ({ bucket: d.day, value: d.conversions }))} />
      </div>
      <p className="-mt-6 text-xs text-muted-foreground">Daily, in UTC{by !== "day" ? " (the other tabs follow your range)" : ""}.</p>

      <ReportGrid id="overview-channels" title="Top channels" columns={[
        { key: "label", label: "Channel" }, { key: "sessions", label: "Visits", format: "count", bar: true },
        { key: "signups", label: "Signups", format: "count" }, { key: "revenue_cents", label: "Revenue", format: "money" },
      ]} rows={a.channels.slice(0, 6).map((c) => ({ ...c, label: channelLabel(c.channel) }))} />
    </div>
  );
}
