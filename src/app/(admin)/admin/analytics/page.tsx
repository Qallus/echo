import Link from "next/link";
import { AdminPage, Section } from "@/components/admin/admin-ui";
import { BarChart } from "@/components/admin/bar-chart";
import { can, requireStaff } from "@/lib/admin/guard";
import { METRIC_GROUPS as GROUPS } from "@/lib/admin/metrics";
import { RANGES, isRange, rangeDates } from "@/lib/admin/ranges";
import { loadOrganization } from "@/lib/settings/organization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics · Admin · Echo" };

// Real numbers over time, in the organization's time zone.
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const staff = await requireStaff("analytics.view");
  const supabase = await createClient();
  const { range: raw } = await searchParams;
  const range = isRange(raw) && raw !== "custom" ? raw : "30d";
  const org = await loadOrganization(supabase);
  const { since, until, by } = rangeDates(range, org.timezone);
  const groups = GROUPS.map((g) => ({ ...g, metrics: g.metrics.filter((m) => !m.needs || can(staff, m.needs)) })).filter((g) => g.metrics.length);
  const series = new Map(await Promise.all(groups.flatMap((g) => g.metrics).map(async (m) => {
    const { data, error } = await supabase.rpc("admin_series", { p_metric: m.id, p_bucket: by, p_since: since, p_until: until });
    if (error) throw new Error(error.message);
    return [m.id, ((data ?? []) as { bucket: string; value: number }[]).map((p) => ({ bucket: p.bucket, value: Number(p.value) }))] as const;
  })));

  return (
    <AdminPage title="Analytics" description={`${since} to ${until} by ${by} · ${org.timezone.replace(/_/g, " ")}`}
      actions={
        <nav aria-label="Date range" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {RANGES.map((r) => (
            <Link key={r.id} href={`/admin/analytics?range=${r.id}`} aria-current={r.id === range ? "page" : undefined}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", r.id === range ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r.label}</Link>
          ))}
        </nav>
      }>
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.metrics.map((m) => <BarChart key={m.id} title={m.title} unit={m.unit} by={by} points={series.get(m.id) ?? []} />)}
          </div>
        </Section>
      ))}
    </AdminPage>
  );
}
