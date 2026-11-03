"use server";

import { adminAudit } from "@/lib/admin/audit";
import { queueAutomations } from "@/lib/comms/automations";
import { requireStaff } from "@/lib/admin/guard";
import { STAGES, isStage } from "@/lib/crm/deals";
import { isCompanyStatus, isContactRole, isContactStatus, isLeadStatus } from "@/lib/crm/types";
import { list, ref, refresh, uuids, type Result } from "@/lib/crm/validate";
import { createClient } from "@/lib/supabase/server";

// Bulk changes from the list views (crm.manage, audited). Up to 500 records
// at a time; RLS checks the permission again.

type Table = "crm_contacts" | "crm_companies" | "crm_deals";
export type BulkChange = {
  add_tags?: string; remove_tags?: string; role?: string; status?: string; lead_status?: string;
  stage?: string; owner_id?: string | null;
};

function clean(table: Table, c: BulkChange): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  if ("owner_id" in c) out.owner_id = ref(c.owner_id);
  if (c.role !== undefined) { if (table !== "crm_contacts" || !isContactRole(c.role)) return "Pick a role."; out.role = c.role; }
  if (c.lead_status !== undefined) { if (table !== "crm_contacts") return "Not available here."; out.lead_status = isLeadStatus(c.lead_status) ? c.lead_status : null; }
  if (c.status !== undefined) {
    const ok = table === "crm_contacts" ? isContactStatus(c.status) : table === "crm_companies" ? isCompanyStatus(c.status) : false;
    if (!ok) return "Pick a status.";
    out.status = c.status;
  }
  if (c.stage !== undefined) { if (table !== "crm_deals" || !isStage(c.stage)) return "Pick a stage."; out.stage = c.stage; out.probability = STAGES[c.stage].prob; }
  return out;
}

export async function bulkUpdate(table: Table, ids: string[], change: BulkChange): Promise<Result> {
  await requireStaff("crm.manage");
  if (!["crm_contacts", "crm_companies", "crm_deals"].includes(table)) return { error: "Not found." };
  const targets = uuids(ids);
  if (!targets.length) return { error: "Select at least one." };
  const row = clean(table, change);
  if (typeof row === "string") return { error: row };
  const add = list(change.add_tags), remove = new Set(list(change.remove_tags).map((t) => t.toLowerCase()));
  if (!Object.keys(row).length && !add.length && !remove.size) return { error: "Nothing to change." };
  if ((add.length || remove.size) && table === "crm_deals") return { error: "Deals don't have tags." };

  const supabase = await createClient();
  if (Object.keys(row).length) {
    const { error } = await supabase.from(table).update(row).in("id", targets);
    if (error) return { error: error.message };
  }
  if (add.length || remove.size) {
    const { data, error } = await supabase.from(table).select("id, tags").in("id", targets);
    if (error) return { error: error.message };
    const results = await Promise.all((data ?? []).map((r) => {
      const tags = [...new Set([...(r.tags as string[]), ...add])].filter((t) => !remove.has(t.toLowerCase())).slice(0, 20);
      return supabase.from(table).update({ tags }).eq("id", r.id);
    }));
    const failed = results.find((r) => r.error);
    if (failed?.error) return { error: failed.error.message };
  }
  if (table === "crm_deals" && typeof row.stage === "string") {
    const stage = row.stage;
    await queueAutomations(supabase, "stage_changed", targets.map((dealId) => ({ dealId, stage })));
    if (stage === "closed_won" || stage === "closed_lost") await queueAutomations(supabase, stage, targets.map((dealId) => ({ dealId })));
  }
  await adminAudit(supabase, "crm.bulk.update", { type: table, id: targets[0] }, { count: targets.length, fields: [...Object.keys(row), ...(add.length ? ["add_tags"] : []), ...(remove.size ? ["remove_tags"] : [])] });
  refresh();
  return { ok: `${targets.length} updated.` };
}

export async function bulkDelete(table: Table, ids: string[]): Promise<Result> {
  await requireStaff("crm.manage");
  if (!["crm_contacts", "crm_companies", "crm_deals"].includes(table)) return { error: "Not found." };
  const targets = uuids(ids);
  if (!targets.length) return { error: "Select at least one." };
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).delete().in("id", targets).select("id");
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.bulk.delete", { type: table, id: targets[0] }, { count: data?.length ?? 0 });
  refresh();
  return { ok: `${data?.length ?? 0} deleted.` };
}
