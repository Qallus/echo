"use server";

import { adminAudit } from "@/lib/admin/audit";
import { queueAutomations } from "@/lib/comms/automations";
import { requireStaff } from "@/lib/admin/guard";
import { STAGES } from "@/lib/crm/deals";
import { isActivityKind, isCompanyStatus, isContactRole, isLeadStatus, isStage, type ActivityKind, type CompanyStatus, type ContactRole, type DealStage, type LeadStatus } from "@/lib/crm/types";
import { cents, date, email, list, ref, refresh, text, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// CRM writes (crm.manage). RLS checks the permission again; every change is
// written to the admin audit log (names and fields, never note text).

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
export type CompanyInput = {
  name: string; status: CompanyStatus; website?: string; industry?: string; phone?: string; email?: string;
  address?: string; notes?: string; tags?: string; owner_id?: string;
};

export async function saveCompany(id: string | null, input: CompanyInput): Promise<Result> {
  await requireStaff("crm.manage");
  const name = text(input.name, 200);
  if (!name) return { error: "Give the client a name." };
  const mail = email(input.email);
  if (mail === false) return { error: "That email address doesn't look right." };
  const row = {
    name, status: isCompanyStatus(input.status) ? input.status : "prospect",
    website: text(input.website, 300), industry: text(input.industry, 100), phone: text(input.phone, 40), email: mail,
    address: text(input.address, 400), notes: text(input.notes, 10000), tags: list(input.tags), owner_id: ref(input.owner_id),
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("crm_companies").update(row).eq("id", id).select("id").single()
    : await supabase.from("crm_companies").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, id ? "crm.client.update" : "crm.client.create", { type: "crm_company", id: data.id }, { name, status: row.status });
  refresh();
  return { ok: id ? "Saved." : `${name} added.`, id: data.id };
}

export async function deleteCompany(id: string): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_companies").delete().eq("id", id).select("name").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.client.delete", { type: "crm_company", id }, { name: data.name });
  refresh();
  return { ok: `${data.name} deleted.` };
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------
export type ContactInput = {
  first_name: string; last_name?: string; email?: string; phone?: string; title?: string; company_id?: string;
  source?: string; notes?: string; tags?: string; owner_id?: string; role?: ContactRole; lead_status?: LeadStatus | "";
  interest?: string; website?: string; city?: string; state?: string;
};

export async function saveContact(id: string | null, input: ContactInput): Promise<Result> {
  await requireStaff("crm.manage");
  const first = text(input.first_name, 100);
  if (!first) return { error: "Enter a first name." };
  const mail = email(input.email);
  if (mail === false) return { error: "That email address doesn't look right." };
  const row = {
    first_name: first, last_name: text(input.last_name, 100), email: mail, phone: text(input.phone, 40), title: text(input.title, 120),
    company_id: ref(input.company_id), source: text(input.source, 100), notes: text(input.notes, 10000), tags: list(input.tags),
    owner_id: ref(input.owner_id), role: isContactRole(input.role) ? input.role : "contact",
    lead_status: isLeadStatus(input.lead_status) ? input.lead_status : input.role === "lead" ? "new" : null,
    interest: text(input.interest, 200), website: text(input.website, 300), city: text(input.city, 100), state: text(input.state, 100),
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("crm_contacts").update(row).eq("id", id).select("id").single()
    : await supabase.from("crm_contacts").insert(row).select("id").single();
  if (error) return { error: error.message };
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  await adminAudit(supabase, id ? "crm.contact.update" : "crm.contact.create", { type: "crm_contact", id: data.id }, { name });
  if (!id && row.role === "lead") await queueAutomations(supabase, "lead_created", [{ contactId: data.id }]);
  refresh();
  return { ok: id ? "Saved." : `${name} added.`, id: data.id };
}

export async function deleteContact(id: string): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_contacts").delete().eq("id", id).select("first_name, last_name").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
  await adminAudit(supabase, "crm.contact.delete", { type: "crm_contact", id }, { name });
  refresh();
  return { ok: `${name} deleted.` };
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export type DealInput = {
  title: string; stage: DealStage; value?: string; company_id?: string; contact_id?: string; expected_close?: string;
  next_step?: string; next_step_due?: string; source?: string; lost_reason?: string; notes?: string; owner_id?: string;
  opportunity_type?: string; products?: string;
};

export async function saveDeal(id: string | null, input: DealInput): Promise<Result> {
  await requireStaff("crm.manage");
  const title = text(input.title, 200);
  if (!title) return { error: "Give the deal a name." };
  const value = cents(input.value);
  if (value == null) return { error: "Enter the value in dollars, e.g. 1200." };
  const stage: DealStage = isStage(input.stage) ? input.stage : "new_working";
  const row = {
    title, stage, value_cents: value, ...(id ? {} : { probability: STAGES[stage].prob }),
    company_id: ref(input.company_id), contact_id: ref(input.contact_id), expected_close: date(input.expected_close),
    next_step: text(input.next_step, 300), next_step_due: date(input.next_step_due), source: text(input.source, 100),
    ...("lost_reason" in input ? { lost_reason: text(input.lost_reason, 500) } : {}), notes: text(input.notes, 10000), owner_id: ref(input.owner_id),
    opportunity_type: text(input.opportunity_type, 80), products: list(input.products, 30, 80),
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("crm_deals").update(row).eq("id", id).select("id").single()
    : await supabase.from("crm_deals").insert(row).select("id").single();
  if (error) return { error: error.message };
  if (!id) await queueAutomations(supabase, "added_to_pipeline", [{ dealId: data.id }]);
  await adminAudit(supabase, id ? "crm.deal.update" : "crm.deal.create", { type: "crm_deal", id: data.id },
    { title, stage: row.stage, value_cents: row.value_cents });
  refresh();
  return { ok: id ? "Saved." : `${title} added.`, id: data.id };
}

// Moves a deal and resets its probability to the stage default. Closing can
// carry the won summary or the lost reason and notes.
export async function moveDeal(id: string, stage: DealStage, outcome?: { won_summary?: string; lost_reason?: string; lost_notes?: string }): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id) || !isStage(stage)) return { error: "Not found." };
  const patch: Record<string, unknown> = { stage, probability: STAGES[stage].prob };
  if (stage === "closed_won" && outcome) patch.won_summary = text(outcome.won_summary, 2000);
  if (stage === "closed_lost" && outcome) { patch.lost_reason = text(outcome.lost_reason, 500); patch.lost_notes = text(outcome.lost_notes, 2000); }
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_deals").update(patch).eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.deal.stage", { type: "crm_deal", id }, { title: data.title, stage });
  await queueAutomations(supabase, "stage_changed", [{ dealId: id, stage }]);
  if (stage === "closed_won" || stage === "closed_lost") await queueAutomations(supabase, stage, [{ dealId: id }]);
  refresh();
  return { ok: `Moved to ${STAGES[stage].label}.` };
}

export async function deleteDeal(id: string): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_deals").delete().eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.deal.delete", { type: "crm_deal", id }, { title: data.title });
  refresh();
  return { ok: `${data.title} deleted.` };
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export async function addActivity(input: {
  kind: ActivityKind; body: string; due?: string; company_id?: string | null; contact_id?: string | null; deal_id?: string | null;
}): Promise<Result> {
  await requireStaff("crm.manage");
  const body = text(input.body, 10000);
  if (!body) return { error: "Write something first." };
  const kind = isActivityKind(input.kind) ? input.kind : "note";
  const row = {
    kind, body, due_at: kind === "task" && date(input.due) ? `${input.due}T12:00:00Z` : null,
    company_id: ref(input.company_id), contact_id: ref(input.contact_id), deal_id: ref(input.deal_id),
  };
  if (!row.company_id && !row.contact_id && !row.deal_id) return { error: "Not attached to a record." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_activities").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.activity.create", { type: "crm_activity", id: data.id },
    { kind, company_id: row.company_id, contact_id: row.contact_id, deal_id: row.deal_id });
  refresh();
  return { ok: "Added.", id: data.id };
}

export async function setActivityDone(id: string, done: boolean): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_activities").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, done ? "crm.task.done" : "crm.task.reopen", { type: "crm_activity", id });
  refresh();
  return { ok: done ? "Done." : "Reopened." };
}

export async function deleteActivity(id: string): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_activities").delete().eq("id", id).select("kind").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.activity.delete", { type: "crm_activity", id }, { kind: data.kind });
  refresh();
  return { ok: "Deleted." };
}
