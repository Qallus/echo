"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { can, requireStaff } from "@/lib/admin/guard";
import { date, list, ref, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { PLAN_TEMPLATES } from "@/lib/plans/templates";
import { isPriority, isTaskStatus, type ChecklistItem, type Priority, type TaskStatus } from "@/lib/plans/types";
import { createClient } from "@/lib/supabase/server";

// Plans (crm.manage or projects.manage; RLS checks again). Plan-level changes
// are audited; individual task edits are frequent, so only creates/deletes are.

async function guard() {
  const staff = await requireStaff("crm.view");
  if (!can(staff, "crm.manage") && !can(staff, "projects.manage")) throw new Error("You can view plans but not change them.");
}
const done = <T extends Result>(r: T, planId?: string): T => { revalidatePath("/admin/plans"); if (planId) revalidatePath(`/admin/plans/${planId}`); return r; };
const addDays = (start: string, days: number) => { const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export async function createPlan(input: { name: string; template: string; description?: string; company_id?: string | null; deal_id?: string | null; owner_id?: string | null; start_date?: string; color?: string }): Promise<Result> {
  await guard();
  const name = text(input.name, 160);
  if (!name) return { error: "Name the plan." };
  const tpl = PLAN_TEMPLATES.find((t) => t.id === input.template) ?? PLAN_TEMPLATES[0];
  const start = date(input.start_date) ?? new Date().toLocaleDateString("en-CA");
  const maxDue = Math.max(0, ...tpl.tasks.map((t) => t.due ?? 0));
  const supabase = await createClient();
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
  return done({ ok: "Plan created.", id: plan.id });
}

export async function updatePlan(id: string, patch: { name?: string; description?: string | null; color?: string; status?: string; default_view?: string; company_id?: string | null; deal_id?: string | null; owner_id?: string | null; start_date?: string | null; due_date?: string | null }): Promise<Result> {
  await guard();
  if (!isUuid(id)) return { error: "Not found." };
  const row: Record<string, unknown> = {};
  if ("name" in patch) { const n = text(patch.name, 160); if (!n) return { error: "Name the plan." }; row.name = n; }
  if ("description" in patch) row.description = text(patch.description, 5000);
  if ("color" in patch) row.color = text(patch.color, 20) ?? "slate";
  if ("status" in patch) row.status = patch.status === "archived" ? "archived" : "active";
  if ("default_view" in patch && ["board", "list", "grid", "calendar"].includes(patch.default_view ?? "")) row.default_view = patch.default_view;
  for (const k of ["company_id", "deal_id", "owner_id"] as const) if (k in patch) row[k] = ref(patch[k]);
  for (const k of ["start_date", "due_date"] as const) if (k in patch) row[k] = date(patch[k]);
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update(row).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "plans.update", { type: "plan", id }, { fields: Object.keys(row) });
  return done({ ok: "Saved." }, id);
}

export async function deletePlan(id: string): Promise<Result> {
  await guard();
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").delete().eq("id", id).select("name").maybeSingle();
  if (error) return { error: error.message };
  await adminAudit(supabase, "plans.delete", { type: "plan", id }, { name: data?.name });
  return done({ ok: "Plan deleted." });
}

export async function saveGroup(planId: string, id: string | null, name: string): Promise<Result> {
  await guard();
  const n = text(name, 80);
  if (!isUuid(planId) || !n) return { error: "Name the column." };
  const supabase = await createClient();
  if (id && isUuid(id)) {
    const { error } = await supabase.from("plan_groups").update({ name: n }).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase.from("plan_groups").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    const { error } = await supabase.from("plan_groups").insert({ plan_id: planId, name: n, position: count ?? 0 });
    if (error) return { error: error.message };
  }
  return done({ ok: "Saved." }, planId);
}

export async function deleteGroup(planId: string, id: string): Promise<Result> {
  await guard();
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_groups").delete().eq("id", id);
  if (error) return { error: error.message };
  return done({ ok: "Column deleted; its tasks are kept without a column." }, planId);
}

export type TaskPatch = Partial<{
  title: string; notes: string | null; status: TaskStatus; priority: Priority; assignee_id: string | null; group_id: string | null;
  start_date: string | null; due_date: string | null; is_milestone: boolean; labels: string[]; checklist: ChecklistItem[]; position: number;
}>;

function cleanTask(p: TaskPatch): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  if ("title" in p) { const t = text(p.title, 300); if (!t) return "Give the task a title."; out.title = t; }
  if ("notes" in p) out.notes = text(p.notes, 20000);
  if ("status" in p) { if (!isTaskStatus(p.status)) return "Pick a status."; out.status = p.status; }
  if ("priority" in p) { if (!isPriority(p.priority)) return "Pick a priority."; out.priority = p.priority; }
  if ("assignee_id" in p) out.assignee_id = ref(p.assignee_id);
  if ("group_id" in p) out.group_id = ref(p.group_id);
  if ("start_date" in p) out.start_date = date(p.start_date);
  if ("due_date" in p) out.due_date = date(p.due_date);
  if ("is_milestone" in p) out.is_milestone = Boolean(p.is_milestone);
  if ("labels" in p) out.labels = list(p.labels, 10, 30);
  if ("position" in p) out.position = Math.round(Number(p.position) || 0);
  if ("checklist" in p) out.checklist = (Array.isArray(p.checklist) ? p.checklist : []).slice(0, 50)
    .filter((c) => c && typeof c.id === "string" && typeof c.title === "string")
    .map((c) => ({ id: c.id.slice(0, 40), title: c.title.slice(0, 200), done: Boolean(c.done) }));
  return out;
}

export async function addTask(planId: string, input: { title: string; group_id?: string | null; due_date?: string | null; assignee_id?: string | null }): Promise<Result> {
  await guard();
  const title = text(input.title, 300);
  if (!isUuid(planId) || !title) return { error: "Give the task a title." };
  const supabase = await createClient();
  const { count } = await supabase.from("plan_tasks").select("id", { count: "exact", head: true }).eq("plan_id", planId);
  const { data, error } = await supabase.from("plan_tasks").insert({
    plan_id: planId, title, group_id: ref(input.group_id), due_date: date(input.due_date), assignee_id: ref(input.assignee_id), position: count ?? 0,
  }).select("id").single();
  if (error) return { error: error.message };
  return done({ ok: "Added.", id: data.id }, planId);
}

export async function updateTask(planId: string, id: string, patch: TaskPatch): Promise<Result> {
  await guard();
  if (!isUuid(id)) return { error: "Not found." };
  const row = cleanTask(patch);
  if (typeof row === "string") return { error: row };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_tasks").update(row).eq("id", id);
  if (error) return { error: error.message };
  return done({ ok: "Saved." }, planId);
}

export async function deleteTasks(planId: string, ids: string[]): Promise<Result> {
  await guard();
  const targets = uuids(ids);
  if (!targets.length) return { error: "Nothing to delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_tasks").delete().in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "plans.tasks.delete", { type: "plan", id: planId }, { count: targets.length });
  return done({ ok: "Deleted." }, planId);
}

export async function bulkUpdateTasks(planId: string, ids: string[], patch: TaskPatch): Promise<Result> {
  await guard();
  const targets = uuids(ids);
  const row = cleanTask(patch);
  if (typeof row === "string") return { error: row };
  if (!targets.length || !Object.keys(row).length) return { error: "Nothing to update." };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_tasks").update(row).in("id", targets);
  if (error) return { error: error.message };
  return done({ ok: `${targets.length} updated.` }, planId);
}
