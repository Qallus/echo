"use server";

import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isNextStepType, isStage, newId, type CustomField, type ExtraStep } from "@/lib/crm/deals";
import { parseStageConfig, type StageConfig } from "@/lib/crm/guidance";
import { contactsToDeals } from "@/lib/crm/ops";
import { cents, date, list, ref, refresh, text, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// The opportunity workspace: inline edits, Next Steps, stage setup, and
// turning contacts or leads into opportunities (crm.manage, audited).

export type DealPatch = Partial<{
  title: string; value: number | string; expected_close: string | null; owner_id: string | null; opportunity_type: string | null;
  probability: number; source: string | null; products: string[]; next_step: string | null; next_step_due: string | null;
  next_step_type: string | null; next_step_priority: string; notes: string | null; competitor: string | null;
  custom_fields: CustomField[]; extra_steps: ExtraStep[];
}>;

function cleanPatch(p: DealPatch): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  if ("title" in p) { const t = text(p.title, 200); if (!t) return "Give the deal a name."; out.title = t; }
  if ("value" in p) { const v = cents(p.value); if (v == null) return "Enter the value in dollars."; out.value_cents = v; }
  if ("expected_close" in p) out.expected_close = date(p.expected_close);
  if ("owner_id" in p) out.owner_id = ref(p.owner_id);
  if ("opportunity_type" in p) out.opportunity_type = text(p.opportunity_type, 80);
  if ("probability" in p) out.probability = Math.max(0, Math.min(100, Math.round(Number(p.probability) || 0)));
  if ("source" in p) out.source = text(p.source, 100);
  if ("products" in p) out.products = list(p.products, 30, 80);
  if ("next_step" in p) out.next_step = text(p.next_step, 300);
  if ("next_step_due" in p) out.next_step_due = date(p.next_step_due);
  if ("next_step_type" in p) out.next_step_type = isNextStepType(p.next_step_type) ? p.next_step_type : null;
  if ("next_step_priority" in p) out.next_step_priority = ["low", "normal", "high"].includes(String(p.next_step_priority)) ? p.next_step_priority : "normal";
  if ("notes" in p) out.notes = text(p.notes, 10000);
  if ("competitor" in p) out.competitor = text(p.competitor, 120);
  if ("custom_fields" in p) {
    out.custom_fields = (Array.isArray(p.custom_fields) ? p.custom_fields : []).slice(0, 30)
      .filter((f) => f && typeof f.id === "string" && typeof f.label === "string" && ["text", "number", "date"].includes(f.type))
      .map((f) => ({ id: f.id.slice(0, 40), label: f.label.slice(0, 60), type: f.type, value: String(f.value ?? "").slice(0, 500) }));
  }
  if ("extra_steps" in p) {
    out.extra_steps = (Array.isArray(p.extra_steps) ? p.extra_steps : []).slice(0, 30)
      .filter((s) => s && typeof s.id === "string" && typeof s.label === "string" && isStage(s.stage))
      .map((s) => ({ id: s.id.slice(0, 40), label: s.label.slice(0, 160), stage: s.stage, required: Boolean(s.required) }));
  }
  return out;
}

export async function updateDeal(id: string, patch: DealPatch): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const row = cleanPatch(patch);
  if (typeof row === "string") return { error: row };
  if (!Object.keys(row).length) return { ok: "Nothing to change." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_deals").update(row).eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.deal.update", { type: "crm_deal", id }, { title: data.title, fields: Object.keys(row) });
  refresh();
  return { ok: "Saved." };
}

// Ticks or unticks one Next Step, keyed "<stage>:<step id>".
export async function toggleDealStep(id: string, key: string, done: boolean): Promise<Result> {
  await requireStaff("crm.manage");
  const [stage, step] = key.split(":");
  if (!isUuid(id) || !isStage(stage) || !step || step.length > 40) return { error: "Not found." };
  const supabase = await createClient();
  const { data: deal } = await supabase.from("crm_deals").select("checklist").eq("id", id).maybeSingle();
  if (!deal) return { error: "Not found." };
  const checklist = { ...(deal.checklist as Record<string, boolean>) };
  if (done) checklist[key] = true; else delete checklist[key];
  const { error } = await supabase.from("crm_deals").update({ checklist }).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.deal.step", { type: "crm_deal", id }, { step: key, done });
  refresh();
  return { ok: done ? "Done." : "Reopened." };
}

// Configure stages: the goal, actions and Next Steps for every stage.
export async function saveStageConfig(config: StageConfig): Promise<Result> {
  await requireStaff("crm.manage");
  const value = parseStageConfig(config);
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "crm_stages", value });
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.stages.save", { type: "setting", id: "crm_stages" }, { stages: Object.keys(value) });
  refresh();
  return { ok: "Pipeline stages updated." };
}

// Contacts or leads -> opportunities (see contactsToDeals).
export async function addToPipeline(contactIds: string[]): Promise<Result & { created?: number; dealIds?: string[] }> {
  await requireStaff("crm.manage");
  const result = await contactsToDeals(await createClient(), contactIds);
  refresh();
  return result;
}

// A per-deal Next Step, added from the workspace.
export async function addDealStep(id: string, label: string): Promise<Result> {
  await requireStaff("crm.manage");
  const clean = text(label, 160);
  if (!isUuid(id) || !clean) return { error: "Write the step first." };
  const supabase = await createClient();
  const { data: deal } = await supabase.from("crm_deals").select("stage, extra_steps").eq("id", id).maybeSingle();
  if (!deal) return { error: "Not found." };
  return updateDeal(id, { extra_steps: [...(deal.extra_steps as ExtraStep[]), { id: newId("step"), label: clean, stage: deal.stage }] });
}
