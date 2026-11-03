import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Plan, PlanGroup, PlanSummary, PlanTask } from "./types";

// Plan reads for the admin (RLS: crm.view).

export async function listPlans(): Promise<PlanSummary[]> {
  const supabase = await createClient();
  const [{ data: plans }, { data: tasks }] = await Promise.all([
    supabase.from("plans").select("*, company:crm_companies(id, name)").order("updated_at", { ascending: false }),
    supabase.from("plan_tasks").select("plan_id, status, due_date"),
  ]);
  const today = new Date().toLocaleDateString("en-CA");
  return ((plans ?? []) as Plan[]).map((p) => {
    const mine = (tasks ?? []).filter((t) => t.plan_id === p.id);
    return { ...p, tasks: mine.length, done: mine.filter((t) => t.status === "complete").length,
      overdue: mine.filter((t) => t.status !== "complete" && t.due_date && t.due_date < today).length };
  });
}

export async function getPlan(id: string): Promise<{ plan: Plan; groups: PlanGroup[]; tasks: PlanTask[] } | null> {
  const supabase = await createClient();
  const [{ data: plan }, { data: groups }, { data: tasks }] = await Promise.all([
    supabase.from("plans").select("*, company:crm_companies(id, name)").eq("id", id).maybeSingle(),
    supabase.from("plan_groups").select("*").eq("plan_id", id).order("position"),
    supabase.from("plan_tasks").select("*").eq("plan_id", id).order("position"),
  ]);
  if (!plan) return null;
  return { plan: plan as Plan, groups: (groups ?? []) as PlanGroup[], tasks: (tasks ?? []) as PlanTask[] };
}

// Open plan tasks per assignee (for the Team page).
export async function openTasksByAssignee(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("plan_tasks").select("assignee_id").neq("status", "complete").not("assignee_id", "is", null);
  const out: Record<string, number> = {};
  for (const t of data ?? []) out[t.assignee_id!] = (out[t.assignee_id!] ?? 0) + 1;
  return out;
}
