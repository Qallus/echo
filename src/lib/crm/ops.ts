import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import { queueAutomations } from "@/lib/comms/automations";
import { STAGES, isStage, type DealStage } from "./deals";
import { contactName } from "./types";
import { text, uuids, type Result } from "./validate";
import { isUuid } from "@/lib/data";

// CRM changes shared by the dashboard's server actions and the MCP tools.
// They take the caller's client (RLS checks crm.manage) and write the admin
// audit log; callers check the permission first and refresh pages after.

// Moves a deal and resets its probability to the stage default. Closing can
// carry the won summary or the lost reason and notes.
export async function moveDealStage(
  supabase: SupabaseClient, id: string, stage: DealStage,
  outcome?: { won_summary?: string; lost_reason?: string; lost_notes?: string },
): Promise<Result> {
  if (!isUuid(id) || !isStage(stage)) return { error: "Not found." };
  const patch: Record<string, unknown> = { stage, probability: STAGES[stage].prob };
  if (stage === "closed_won" && outcome) patch.won_summary = text(outcome.won_summary, 2000);
  if (stage === "closed_lost" && outcome) { patch.lost_reason = text(outcome.lost_reason, 500); patch.lost_notes = text(outcome.lost_notes, 2000); }
  const { data, error } = await supabase.from("crm_deals").update(patch).eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.deal.stage", { type: "crm_deal", id }, { title: data.title, stage });
  await queueAutomations(supabase, "stage_changed", [{ dealId: id, stage }]);
  if (stage === "closed_won" || stage === "closed_lost") await queueAutomations(supabase, stage, [{ dealId: id }]);
  return { ok: `Moved to ${STAGES[stage].label}.` };
}

// Contacts or leads -> opportunities. Links each deal to the existing contact
// (never copies the person), carries over source, owner and notes, skips anyone
// who already has an open deal, and marks them prospect / in pipeline.
export async function contactsToDeals(supabase: SupabaseClient, contactIds: string[]): Promise<Result & { created?: number; skipped?: number; dealIds?: string[] }> {
  const ids = uuids(contactIds);
  if (!ids.length) return { error: "Choose at least one contact." };
  const [{ data: contacts }, { data: open }] = await Promise.all([
    supabase.from("crm_contacts").select("id, first_name, last_name, company_id, source, owner_id, notes, interest, role, company:crm_companies(name)").in("id", ids),
    supabase.from("crm_deals").select("id, contact_id").in("contact_id", ids).not("stage", "in", "(closed_won,closed_lost)"),
  ]);
  const busy = new Set((open ?? []).map((d) => d.contact_id));
  const fresh = (contacts ?? []).filter((c) => !busy.has(c.id));
  const close = new Date(Date.now() + 30 * 86400_000).toLocaleDateString("en-CA");
  const rows = fresh.map((c) => {
    const company = (c.company as unknown as { name: string } | null)?.name;
    const person = contactName(c);
    return {
      title: company ? `${company}: ${person}` : person, stage: "new_working", probability: STAGES.new_working.prob,
      contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id, source: c.source ?? "Existing contact",
      expected_close: close, notes: [c.notes, c.interest && `Interest: ${c.interest}`].filter(Boolean).join("\n\n") || null,
    };
  });
  let dealIds: string[] = [];
  if (rows.length) {
    const { data, error } = await supabase.from("crm_deals").insert(rows).select("id");
    if (error) return { error: error.message };
    dealIds = (data ?? []).map((d) => d.id);
    const promote = fresh.filter((c) => c.role === "contact" || c.role === "lead").map((c) => c.id);
    await supabase.from("crm_contacts").update({ lead_status: "in_pipeline" }).in("id", fresh.map((c) => c.id));
    if (promote.length) await supabase.from("crm_contacts").update({ role: "prospect" }).in("id", promote);
    await queueAutomations(supabase, "added_to_pipeline", dealIds.map((dealId) => ({ dealId })));
    await adminAudit(supabase, "crm.pipeline.add", { type: "crm_deal", id: dealIds[0] }, { contacts: fresh.length, deals: dealIds });
  }
  const skipped = (contacts ?? []).length - fresh.length;
  return {
    ok: `${rows.length ? `${rows.length} added to the pipeline.` : "Nothing new added."}${skipped ? ` ${skipped} already had an open deal.` : ""}`,
    created: rows.length, skipped, dealIds, id: dealIds[0],
  };
}


export { importContactRows, type ImportRow, type ImportResult } from "./import-rows";
