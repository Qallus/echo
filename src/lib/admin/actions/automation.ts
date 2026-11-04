"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { subjectOf, validateRule, type Condition, type RuleAction, type RuleTrigger } from "@/lib/automation/rules";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string; id?: string };

export type RuleInput = {
  id?: string; name: string; description: string; enabled: boolean; trigger: RuleTrigger; stage: string | null;
  stalled_days: number; delay_minutes: number; match: "all" | "any"; conditions: Condition[]; actions: RuleAction[];
};

const clampInt = (n: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : d);

export async function saveRule(input: RuleInput): Promise<Result> {
  await requireStaff("comms.manage");
  const problem = validateRule(input);
  if (problem) return { error: problem };
  const row = {
    name: input.name.trim().slice(0, 120), description: input.description.trim().slice(0, 1000) || null, enabled: input.enabled,
    trigger: input.trigger, stage: input.trigger === "stage_changed" ? input.stage || null : null,
    stalled_days: clampInt(input.stalled_days, 1, 365, 14), delay_minutes: clampInt(input.delay_minutes, 0, 525600, 0), match: input.match === "any" ? "any" : "all",
    conditions: input.conditions.map((c) => ({ field: c.field, op: c.op, value: String(c.value ?? "").slice(0, 300) })),
    actions: input.actions,
  };
  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase.from("automation_rules").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("automation_rules").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, input.id ? "automation.rule.update" : "automation.rule.create", { type: "automation_rule", id: data.id },
    { name: row.name, trigger: row.trigger, actions: row.actions.map((a) => a.type) });
  revalidatePath("/admin/automation");
  return { ok: "Saved.", id: data.id };
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<Result> {
  await requireStaff("comms.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").update({ enabled }).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, enabled ? "automation.rule.enable" : "automation.rule.disable", { type: "automation_rule", id });
  revalidatePath("/admin/automation");
  return { ok: enabled ? "Rule on." : "Rule off." };
}

export async function deleteRule(id: string): Promise<Result> {
  await requireStaff("comms.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "automation.rule.delete", { type: "automation_rule", id });
  revalidatePath("/admin/automation");
  return { ok: "Deleted." };
}

// Queues a run of the rule on a chosen record. The scheduled job carries it
// out within five minutes (conditions still apply).
export async function runRuleOn(ruleId: string, recordId: string): Promise<Result> {
  await requireStaff("comms.manage");
  const supabase = await createClient();
  const { data: rule } = await supabase.from("automation_rules").select("id, trigger").eq("id", ruleId).maybeSingle();
  if (!rule) return { error: "Rule not found." };
  const column = { deal: "deal_id", contact: "contact_id", booking: "booking_id", message: "message_id" }[subjectOf(rule.trigger as RuleTrigger)];
  const { error } = await supabase.from("automation_rule_runs").insert({ rule_id: ruleId, run_key: `manual:${recordId}:${Date.now()}`, [column]: recordId });
  if (error) return { error: error.message };
  await adminAudit(supabase, "automation.rule.run", { type: "automation_rule", id: ruleId }, { [column]: recordId });
  revalidatePath("/admin/automation");
  return { ok: "Queued. It runs within five minutes." };
}
