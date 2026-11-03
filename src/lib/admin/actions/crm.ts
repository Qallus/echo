"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isActivityKind, isCompanyStatus, isStage, type ActivityKind, type CompanyStatus, type DealStage } from "@/lib/crm/types";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string; id?: string };

// CRM writes (crm.manage). RLS checks the permission again; every change is
// written to the admin audit log (names and fields, never note text).

const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
const ref = (v: unknown) => (typeof v === "string" && isUuid(v) ? v : null);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const tags = (v: unknown) =>
  typeof v === "string" ? [...new Set(v.split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20) : [];
function email(v: unknown): string | null | false {
  const s = text(v, 200);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : false;
}

function refresh() {
  for (const p of ["/admin/clients", "/admin/contacts", "/admin/pipeline"]) revalidatePath(p, "layout");
}

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
    address: text(input.address, 400), notes: text(input.notes, 10000), tags: tags(input.tags), owner_id: ref(input.owner_id),
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
  source?: string; notes?: string; tags?: string; owner_id?: string;
};

export async function saveContact(id: string | null, input: ContactInput): Promise<Result> {
  await requireStaff("crm.manage");
  const first = text(input.first_name, 100);
  if (!first) return { error: "Enter a first name." };
  const mail = email(input.email);
  if (mail === false) return { error: "That email address doesn't look right." };
  const row = {
    first_name: first, last_name: text(input.last_name, 100), email: mail, phone: text(input.phone, 40), title: text(input.title, 120),
    company_id: ref(input.company_id), source: text(input.source, 100), notes: text(input.notes, 10000), tags: tags(input.tags),
    owner_id: ref(input.owner_id),
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("crm_contacts").update(row).eq("id", id).select("id").single()
    : await supabase.from("crm_contacts").insert(row).select("id").single();
  if (error) return { error: error.message };
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  await adminAudit(supabase, id ? "crm.contact.update" : "crm.contact.create", { type: "crm_contact", id: data.id }, { name });
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
};

export async function saveDeal(id: string | null, input: DealInput): Promise<Result> {
  await requireStaff("crm.manage");
  const title = text(input.title, 200);
  if (!title) return { error: "Give the deal a name." };
  const dollars = Number(String(input.value ?? "").replace(/[$,\s]/g, "") || 0);
  if (!Number.isFinite(dollars) || dollars < 0) return { error: "Enter the value in dollars, e.g. 1200." };
  const row = {
    title, stage: isStage(input.stage) ? input.stage : "lead", value_cents: Math.round(dollars * 100),
    company_id: ref(input.company_id), contact_id: ref(input.contact_id), expected_close: date(input.expected_close),
    next_step: text(input.next_step, 300), next_step_due: date(input.next_step_due), source: text(input.source, 100),
    lost_reason: text(input.lost_reason, 500), notes: text(input.notes, 10000), owner_id: ref(input.owner_id),
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("crm_deals").update(row).eq("id", id).select("id").single()
    : await supabase.from("crm_deals").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, id ? "crm.deal.update" : "crm.deal.create", { type: "crm_deal", id: data.id },
    { title, stage: row.stage, value_cents: row.value_cents });
  refresh();
  return { ok: id ? "Saved." : `${title} added.`, id: data.id };
}

export async function moveDeal(id: string, stage: DealStage): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id) || !isStage(stage)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_deals").update({ stage }).eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.deal.stage", { type: "crm_deal", id }, { title: data.title, stage });
  refresh();
  return { ok: "Moved." };
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
