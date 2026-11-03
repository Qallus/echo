import { OPEN_STAGES, isOverdue, type Activity, type Deal } from "./types";

// Headline numbers for the pipeline page.
export function pipelineStats(deals: Deal[], tasks: Activity[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const since90 = now.getTime() - 90 * 86400_000;
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const closedAfter = (d: Deal, t: number) => Boolean(d.closed_at && Date.parse(d.closed_at) >= t);
  const wonMonth = deals.filter((d) => d.stage === "won" && closedAfter(d, monthStart));
  const won90 = deals.filter((d) => d.stage === "won" && closedAfter(d, since90)).length;
  const lost90 = deals.filter((d) => d.stage === "lost" && closedAfter(d, since90)).length;
  return {
    openCount: open.length,
    openValue: open.reduce((n, d) => n + d.value_cents, 0),
    wonMonthCount: wonMonth.length,
    wonMonthValue: wonMonth.reduce((n, d) => n + d.value_cents, 0),
    winRate: won90 + lost90 ? won90 / (won90 + lost90) : null,
    overdue: open.filter((d) => isOverdue(d.next_step_due)).length + tasks.filter((t) => isOverdue(t.due_at)).length,
  };
}
