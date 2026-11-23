"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { firstRun, isRepeat, type Repeat } from "@/lib/agents/tasks";
import { isUuid } from "@/lib/data";
import { loadOrganization } from "@/lib/settings/organization";
import { createClient } from "@/lib/supabase/server";

// Admin -> AI -> Agents -> Tasks: work for agents to pick up (staff.manage,
// audited). Agents claim and report through agent_task_claim/report.

type Result = { ok?: string; error?: string; id?: string };
export type TaskInput = { title: string; instructions: string; agent_id: string | null; area: string | null; repeat: Repeat; run_time: string | null };

const done = (r: Result) => { revalidatePath("/admin/ai/agents"); return r; };
const SETUP = "Run supabase/migrations/20261124090000_agent_tasks.sql in Supabase first.";

export async function saveAgentTask(id: string | null, input: TaskInput): Promise<Result> {
  await requireStaff("staff.manage");
  const title = input.title?.trim().slice(0, 160);
  if (!title) return { error: "Give the task a title." };
  if (!isRepeat(input.repeat)) return { error: "Pick how often it runs." };
  const runTime = input.run_time && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.run_time) ? input.run_time : null;
  if (input.repeat !== "once" && !runTime) return { error: "Pick a time for a repeating task." };
  const supabase = await createClient();
  const org = await loadOrganization(supabase);
  const row = {
    title, instructions: (input.instructions ?? "").trim().slice(0, 8000),
    agent_id: input.agent_id && isUuid(input.agent_id) ? input.agent_id : null,
    area: input.area?.trim().slice(0, 40) || null, repeat: input.repeat, run_time: runTime,
  };
  const { data: cur } = id ? await supabase.from("agent_tasks").select("repeat, run_time, status").eq("id", id).maybeSingle() : { data: null };
  // A new task, or a changed schedule, gets a fresh first run.
  const reschedule = !cur || cur.repeat !== row.repeat || cur.run_time !== row.run_time;
  const patch = { ...row, ...(reschedule ? { next_run_at: firstRun(row.repeat, runTime, org.timezone).toISOString() } : {}), ...(cur ? { updated_at: new Date().toISOString() } : {}) };
  const { data, error } = id
    ? await supabase.from("agent_tasks").update(patch).eq("id", id).select("id").single()
    : await supabase.from("agent_tasks").insert({ ...patch, status: "queued" }).select("id").single();
  if (error) return { error: /does not exist|schema cache/i.test(error.message) ? SETUP : error.message };
  await adminAudit(supabase, id ? "agent.task.update" : "agent.task.create", { type: "agent_task", id: data.id }, { title, repeat: row.repeat, agent_id: row.agent_id });
  return done({ ok: id ? "Saved." : "Task added. An agent picks it up when it's due.", id: data.id });
}

// Pause, resume, or run now (queued and due immediately).
export async function setAgentTaskState(id: string, state: "pause" | "resume" | "run_now"): Promise<Result> {
  await requireStaff("staff.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const patch = state === "pause" ? { status: "paused" } : state === "resume" ? { status: "queued" } : { status: "queued", next_run_at: new Date().toISOString() };
  const { error } = await supabase.from("agent_tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).neq("status", "claimed");
  if (error) return { error: error.message };
  await adminAudit(supabase, `agent.task.${state}`, { type: "agent_task", id });
  return done({ ok: state === "pause" ? "Paused." : state === "resume" ? "Resumed." : "Queued to run now. The next agent check picks it up." });
}

export async function deleteAgentTask(id: string): Promise<Result> {
  await requireStaff("staff.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("agent_tasks").delete().eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "agent.task.delete", { type: "agent_task", id }, { title: data.title });
  return done({ ok: "Deleted." });
}
