import { Section } from "@/components/admin/admin-ui";
import { BarChart } from "@/components/admin/bar-chart";
import { can, type Staff } from "@/lib/admin/guard";
import { METRIC_GROUPS as GROUPS } from "@/lib/admin/metrics";
import type { SupabaseClient } from "@supabase/supabase-js";

// The original Analytics charts: real numbers over time, by day/week/month.
export async function TrendsTab({ supabase, staff, since, until, by }: { supabase: SupabaseClient; staff: Staff; since: string; until: string; by: string }) {
  const groups = GROUPS.map((g) => ({ ...g, metrics: g.metrics.filter((m) => !m.needs || can(staff, m.needs)) })).filter((g) => g.metrics.length);
  const series = new Map(await Promise.all(groups.flatMap((g) => g.metrics).map(async (m) => {
    const { data, error } = await supabase.rpc("admin_series", { p_metric: m.id, p_bucket: by, p_since: since, p_until: until });
    if (error) throw new Error(error.message);
    return [m.id, ((data ?? []) as { bucket: string; value: number }[]).map((p) => ({ bucket: p.bucket, value: Number(p.value) }))] as const;
  })));
  return (
    <>
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.metrics.map((m) => <BarChart key={m.id} title={m.title} unit={m.unit} by={by} points={series.get(m.id) ?? []} />)}
          </div>
        </Section>
      ))}
    </>
  );
}
