// Plans (Super Admin batch B): task boards, from Channel-Cast's Plan Builder.
// Mirrors supabase/migrations/20261103140000_bookings_plans.sql.

export const TASK_STATUSES = [
  { id: "not_started", label: "Not started", tone: "bg-muted text-muted-foreground" },
  { id: "in_progress", label: "In progress", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { id: "waiting", label: "Waiting", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "blocked", label: "Blocked", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { id: "complete", label: "Complete", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];
export const isTaskStatus = (v: unknown): v is TaskStatus => TASK_STATUSES.some((s) => s.id === v);

export const PRIORITIES = [
  { id: "low", label: "Low", tone: "text-muted-foreground" }, { id: "medium", label: "Medium", tone: "text-foreground" },
  { id: "high", label: "High", tone: "text-amber-700 dark:text-amber-300" }, { id: "urgent", label: "Urgent", tone: "text-rose-700 dark:text-rose-300" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["id"];
export const isPriority = (v: unknown): v is Priority => PRIORITIES.some((p) => p.id === v);

export const PLAN_COLORS = [
  { id: "slate", dot: "bg-slate-400" }, { id: "sky", dot: "bg-sky-500" }, { id: "violet", dot: "bg-violet-500" },
  { id: "amber", dot: "bg-amber-500" }, { id: "emerald", dot: "bg-emerald-500" }, { id: "rose", dot: "bg-rose-500" },
] as const;
export const colorDot = (c: string) => PLAN_COLORS.find((x) => x.id === c)?.dot ?? "bg-slate-400";

export type ChecklistItem = { id: string; title: string; done: boolean };

export type Plan = {
  id: string; name: string; description: string | null; color: string; status: "active" | "archived"; default_view: "board" | "list" | "grid" | "calendar";
  company_id: string | null; deal_id: string | null; owner_id: string | null; start_date: string | null; due_date: string | null; created_at: string; updated_at: string;
  company?: { id: string; name: string } | null;
};
export type PlanGroup = { id: string; plan_id: string; name: string; position: number; color: string | null };
export type PlanTask = {
  id: string; plan_id: string; group_id: string | null; title: string; notes: string | null; status: TaskStatus; priority: Priority; assignee_id: string | null;
  start_date: string | null; due_date: string | null; position: number; is_milestone: boolean; labels: string[]; checklist: ChecklistItem[];
  completed_at: string | null; created_at: string; updated_at: string;
};
export type PlanSummary = Plan & { tasks: number; done: number; overdue: number };
