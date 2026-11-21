import type { SupabaseClient } from "@supabase/supabase-js";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { BarChart } from "@/components/admin/bar-chart";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import { previousRange } from "@/lib/analytics/report";
import { searchConsoleConfig } from "@/lib/analytics/search-console";
import { SyncButton } from "./controls";

type R = { day: string; query: string; page: string; clicks: number; impressions: number; position: number | null };

async function rows(db: SupabaseClient, since: string, until: string): Promise<R[] | null> {
  const { data, error } = await db.from("search_console_rows").select("day, query, page, clicks, impressions, position").gte("day", since).lte("day", until).limit(50000);
  return error ? null : (data as R[]);
}

function group(list: R[], key: "query" | "page") {
  const m = new Map<string, { key: string; clicks: number; impressions: number; posw: number }>();
  for (const r of list) {
    const g = m.get(r[key]) ?? { key: r[key], clicks: 0, impressions: 0, posw: 0 };
    g.clicks += r.clicks; g.impressions += r.impressions; g.posw += (r.position ?? 0) * r.impressions;
    m.set(r[key], g);
  }
  return [...m.values()].map((g) => ({ [key]: key === "page" ? g.key.replace(/^https?:\/\/(www\.)?redial\.si/, "") || "/" : g.key, clicks: g.clicks, impressions: g.impressions, ctr: g.impressions ? g.clicks / g.impressions : 0, position: g.impressions ? g.posw / g.impressions : null }));
}

// Google Search: what people searched, where Redial showed up, what they clicked.
export async function SearchTab({ supabase, since, until, canSync }: { supabase: SupabaseClient; since: string; until: string; canSync: boolean }) {
  const cfg = await searchConsoleConfig();
  const prev = previousRange(since, until);
  const [now, before] = await Promise.all([rows(supabase, since, until), rows(supabase, prev.since, prev.until)]);
  const list = now ?? [];
  const clicks = list.reduce((n, r) => n + r.clicks, 0), impressions = list.reduce((n, r) => n + r.impressions, 0);
  const pos = impressions ? list.reduce((n, r) => n + (r.position ?? 0) * r.impressions, 0) / impressions : null;
  const days = new Map<string, number>();
  for (const r of list) days.set(r.day, (days.get(r.day) ?? 0) + r.clicks);
  const queries = group(list, "query").sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  const pages = group(list, "page").sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  const was = new Map(group(before ?? [], "query").map((q) => [q.query as string, q.clicks]));
  const moves = queries.map((q) => ({ query: q.query, clicks: q.clicks, before: was.get(q.query as string) ?? 0, change: q.clicks - (was.get(q.query as string) ?? 0) })).filter((q) => q.change !== 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">
          {cfg.key ? <>Property <span className="font-medium text-foreground">{cfg.property}</span>, read by <span className="font-medium text-foreground">{cfg.email}</span>. Google&apos;s numbers lag about 2 days; this copies them daily.</>
            : <>Not connected yet: add Redial&apos;s Google service account key in Admin → Settings → Integrations → Google, then add its email as a user in Search Console.</>}
        </span>
        {canSync && cfg.key && <SyncButton />}
      </div>
      {now === null ? <p className="text-sm text-muted-foreground">Run the analytics SQL file to turn this on.</p> : (
        <>
          <StatRow>
            <StatTile label="Clicks from Google" value={clicks.toLocaleString()} />
            <StatTile label="Times shown" value={impressions.toLocaleString()} />
            <StatTile label="Click rate" value={impressions ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—"} />
            <StatTile label="Average position" value={pos ? pos.toFixed(1) : "—"} hint="1 is the top result" />
          </StatRow>
          <BarChart title="Clicks from Google" unit="count" by="day" points={[...days].sort().map(([bucket, value]) => ({ bucket, value }))} />
          <div className="grid gap-8 xl:grid-cols-2">
            <ReportGrid id="search-queries" title="Search terms" columns={[
              { key: "query", label: "Search term" }, { key: "clicks", label: "Clicks", format: "count", bar: true }, { key: "impressions", label: "Shown", format: "count" },
              { key: "ctr", label: "Click rate", format: "percent" }, { key: "position", label: "Position", format: "number" },
            ]} rows={queries.slice(0, 50)} />
            <ReportGrid id="search-pages" title="Pages" columns={[
              { key: "page", label: "Page" }, { key: "clicks", label: "Clicks", format: "count", bar: true }, { key: "impressions", label: "Shown", format: "count" },
              { key: "ctr", label: "Click rate", format: "percent" }, { key: "position", label: "Position", format: "number" },
            ]} rows={pages.slice(0, 50)} />
            <ReportGrid id="search-up" title="Gaining clicks" note="vs the period before" columns={[{ key: "query", label: "Search term" }, { key: "before", label: "Before", format: "count" }, { key: "clicks", label: "Now", format: "count" }, { key: "change", label: "Change", format: "count", bar: true }]}
              rows={moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 15)} />
            <ReportGrid id="search-down" title="Losing clicks" note="vs the period before" columns={[{ key: "query", label: "Search term" }, { key: "before", label: "Before", format: "count" }, { key: "clicks", label: "Now", format: "count" }, { key: "change", label: "Change", format: "count" }]}
              rows={moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 15)} />
          </div>
        </>
      )}
    </div>
  );
}
