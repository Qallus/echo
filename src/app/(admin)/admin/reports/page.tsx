import Link from "next/link";
import { Bookmark, Users } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ReportTable } from "@/components/admin/report-table";
import { can, requireStaff } from "@/lib/admin/guard";
import { RANGES, isRange, rangeDates, type RangeId } from "@/lib/admin/ranges";
import { REPORTS, reportDef, type SavedReport } from "@/lib/admin/reports";
import { loadOrganization } from "@/lib/settings/organization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reports · Admin · Echo" };

type Params = { kind?: string; range?: string; since?: string; until?: string };

const href = (p: Params) => `/admin/reports?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`;

// Pipeline, revenue, communications and usage reports, with CSV export and
// saved (optionally shared) report links.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const staff = await requireStaff("analytics.view");
  const supabase = await createClient();
  const p = await searchParams;
  const available = REPORTS.filter((r) => can(staff, r.needs));
  const asked = reportDef(p.kind);
  const def = asked && can(staff, asked.needs) ? asked : available[0];
  const range: RangeId = isRange(p.range) ? p.range : "90d";
  const org = await loadOrganization(supabase);
  const { since, until } = rangeDates(range, org.timezone, { since: p.since, until: p.until });
  const [{ data: rows, error }, { data: saved }, { data: { user } }] = await Promise.all([
    supabase.rpc("admin_report", { p_kind: def.kind, p_since: since, p_until: until }),
    supabase.from("saved_reports").select("id, name, kind, range, since, until, shared, created_by").order("name"),
    supabase.auth.getUser(),
  ]);
  if (error) throw new Error(error.message);
  const mine = ((saved ?? []) as SavedReport[]).filter((s) => available.some((r) => r.kind === s.kind));

  return (
    <AdminPage title="Reports" description={`${def.title} · ${since} to ${until}`}>
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Reports" className="space-y-5 text-sm">
          <ul className="space-y-0.5">
            {available.map((r) => (
              <li key={r.kind}>
                <Link href={href({ kind: r.kind, range, since: p.since, until: p.until })} aria-current={r.kind === def.kind ? "page" : undefined}
                  className={cn("block rounded-md px-2.5 py-1.5", r.kind === def.kind ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{r.title}</Link>
              </li>
            ))}
          </ul>
          {mine.length > 0 && (
            <div>
              <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">Saved</p>
              <ul className="space-y-0.5">
                {mine.map((s) => (
                  <li key={s.id}>
                    <Link href={href({ kind: s.kind, range: s.range, since: s.since ?? undefined, until: s.until ?? undefined })}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      {s.shared ? <Users className="size-3.5 shrink-0" /> : <Bookmark className="size-3.5 shrink-0" />}<span className="truncate">{s.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Date range" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
              {RANGES.map((r) => (
                <Link key={r.id} href={href({ kind: def.kind, range: r.id })} aria-current={r.id === range ? "page" : undefined}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium", r.id === range ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r.label}</Link>
              ))}
            </nav>
            <form action="/admin/reports" className="flex flex-wrap items-center gap-1.5 text-xs">
              <input type="hidden" name="kind" value={def.kind} />
              <input type="hidden" name="range" value="custom" />
              <label className="sr-only" htmlFor="rep-since">From</label>
              <input id="rep-since" type="date" name="since" defaultValue={since} required className="h-8 rounded-lg border border-input bg-transparent px-2 dark:bg-input/30" />
              <span className="text-muted-foreground">to</span>
              <label className="sr-only" htmlFor="rep-until">To</label>
              <input id="rep-until" type="date" name="until" defaultValue={until} required className="h-8 rounded-lg border border-input bg-transparent px-2 dark:bg-input/30" />
              <button type="submit" className={cn("h-8 rounded-lg border px-2.5 font-medium", range === "custom" ? "bg-accent" : "hover:bg-muted")}>Apply</button>
            </form>
          </div>
          <p className="text-sm text-muted-foreground">{def.description}</p>
          <ReportTable key={`${def.kind}-${since}-${until}`} def={def} rows={(rows ?? []) as Record<string, unknown>[]} range={range} since={since} until={until}
            saved={mine.filter((s) => s.kind === def.kind && s.created_by === user?.id)} />
        </div>
      </div>
    </AdminPage>
  );
}
