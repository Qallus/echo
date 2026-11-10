import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import { date, ref, text, type Result } from "@/lib/crm/validate";
import { PLAN_TEMPLATES } from "./templates";

// A new plan from a template: its groups and tasks, with due dates counted
// from the start date. Shared by Admin -> Plans and the MCP (the caller
// checks crm.manage or projects.manage; RLS checks again).

export type NewPlan = { name: string; template?: string; description?: string; company_id?: string | null; deal_id?: string | null; owner_id?: string | null; start_date?: string; color?: string };

const addDays = (start: string, days: number) => { const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export async function createPlanFromTemplate(supabase: SupabaseClient, input: NewPlan): Promise<Result> {
  const name = text(input.name, 160);
  if (!name) return { error: "Name the plan." };
  const tpl = PLAN_TEMPLATES.find((t) => t.id === input.template) ?? PLAN_TEMPLATES[0];
  const start = date(input.start_date) ?? new Date().toLocaleDateString("en-CA");
  const maxDue = Math.max(0, ...tpl.tasks.map((t) => t.due ?? 0));
  const { data: plan, error } = await supabase.from("plans").insert({
    name, description: text(input.description, 5000) ?? tpl.description, color: text(input.color, 20) ?? "slate", company_id: ref(input.company_id),
    deal_id: ref(input.deal_id), owner_id: ref(input.owner_id), start_date: start, due_date: maxDue ? addDays(start, maxDue) : null,
  }).select("id").single();
  if (error) return { error: error.message };
  const { data: groups, error: gErr } = await supabase.from("plan_groups").insert(tpl.groups.map((g, i) => ({ plan_id: plan.id, name: g, position: i }))).select("id, name");
  if (gErr) return { error: gErr.message };
  const byName = new Map((groups ?? []).map((g) => [g.name, g.id]));
  if (tpl.tasks.length) {
    await supabase.from("plan_tasks").insert(tpl.tasks.map((t, i) => ({
      plan_id: plan.id, group_id: byName.get(t.group) ?? null, title: t.title, priority: t.priority ?? "medium", position: i,
      due_date: t.due != null ? addDays(start, t.due) : null, is_milestone: Boolean(t.milestone), assignee_id: ref(input.owner_id),
    })));
  }
  await adminAudit(supabase, "plans.create", { type: "plan", id: plan.id }, { name, template: tpl.id });
  return { ok: "Plan created.", id: plan.id };
}
