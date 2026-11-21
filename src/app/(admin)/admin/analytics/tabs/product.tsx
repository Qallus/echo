import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import type { Analytics } from "@/lib/analytics/report";
import { stepAt } from "@/lib/redial/setup";

const STATUS: Record<string, string> = {
  ringing: "Ringing", screening: "Screening", connecting: "Connecting", connected: "Connected", message: "Took a message", blocked: "Blocked",
  forwarded: "Forwarded", missed: "Missed", failed: "Failed", completed: "Completed",
};

// Redial itself: where setup stalls, calls screened, scams stopped, and how
// many people keep using it month to month.
export function ProductTab({ a }: { a: Analytics }) {
  const p = a.product;
  const started = Object.values(p.setup_status).reduce((n, v) => n + v, 0);
  const finished = (p.setup_status.submitted ?? 0) + (p.setup_status.active ?? 0);
  return (
    <div className="space-y-8">
      <StatRow>
        <StatTile label="Setups finished" value={`${finished} of ${started}`} hint={started ? `${Math.round((finished / started) * 100)}% finish the wizard` : undefined} />
        <StatTile label="Calls handled" value={p.calls.toLocaleString()} hint={`${p.lines} Redial lines`} />
        <StatTile label="Likely scams caught" value={p.likely_scams.toLocaleString()} hint={`${p.spam} marked spam · ${p.family_alerts} family alerts`} accent />
        <StatTile label="Active subscriptions" value={((p.subscriptions.active ?? 0) + (p.subscriptions.trialing ?? 0)).toLocaleString()} hint={p.subscriptions.canceled ? `${p.subscriptions.canceled} cancelled all-time` : undefined} />
      </StatRow>
      <div className="grid gap-8 xl:grid-cols-2">
        <ReportGrid id="setup-steps" title="Setup wizard: where people are" note="People still in setup, by the step they stopped on."
          columns={[{ key: "label", label: "Step" }, { key: "in_progress", label: "Stopped here", format: "count", bar: true }, { key: "finished", label: "Finished from here", format: "count" }]}
          rows={p.setup_steps.map((s) => ({ ...s, label: `${s.step}. ${stepAt(s.step)?.title ?? ""}` }))} empty="No one has started setup yet." />
        <ReportGrid id="call-outcomes" title="Call outcomes" columns={[{ key: "label", label: "Outcome" }, { key: "calls", label: "Calls", format: "count", bar: true }]}
          rows={Object.entries(p.calls_by_status).map(([k, calls]) => ({ label: STATUS[k] ?? k, calls })).sort((x, y) => y.calls - x.calls)} empty="No calls in this period." />
      </div>
      <ReportGrid id="active-months" title="People using Redial each month" note="Account owners with at least one call that month (last 6 months)."
        columns={[{ key: "month", label: "Month" }, { key: "users", label: "Active people", format: "count", bar: true }, { key: "calls", label: "Calls", format: "count" }]}
        rows={p.active_by_month.map((m) => ({ ...m, month: m.month.slice(0, 7) }))} />
    </div>
  );
}
