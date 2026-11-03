"use server";

import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isActivityKind, isContactRole, isContactStatus, isLeadStatus, type LeadStatus } from "@/lib/crm/types";
import { email, list, ref, refresh, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Contacts and leads: inline edits, bulk actions, CSV import, and activity
// logged by hand (crm.manage, audited).

export type ContactPatch = Partial<Record<
  "first_name" | "last_name" | "email" | "phone" | "title" | "company_id" | "source" | "notes" | "owner_id" | "role" | "status"
  | "lead_status" | "interest" | "website" | "address" | "city" | "state" | "zip", string | null>> & { tags?: string[] | string };

function cleanContact(p: ContactPatch): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  const lens = { last_name: 100, phone: 40, title: 120, source: 100, notes: 10000, interest: 200, website: 300, address: 300, city: 100, state: 100, zip: 20 } as const;
  if ("first_name" in p) { const f = text(p.first_name, 100); if (!f) return "Enter a first name."; out.first_name = f; }
  if ("email" in p) { const e = email(p.email); if (e === false) return "That email address doesn't look right."; out.email = e; }
  for (const [k, max] of Object.entries(lens)) if (k in p) out[k] = text(p[k as keyof typeof lens], max);
  if ("company_id" in p) out.company_id = ref(p.company_id);
  if ("owner_id" in p) out.owner_id = ref(p.owner_id);
  if ("role" in p) { if (!isContactRole(p.role)) return "Pick a role."; out.role = p.role; }
  if ("status" in p) { if (!isContactStatus(p.status)) return "Pick a status."; out.status = p.status; }
  if ("lead_status" in p) out.lead_status = isLeadStatus(p.lead_status) ? p.lead_status : null;
  if ("tags" in p) out.tags = list(p.tags);
  return out;
}

export async function updateContact(id: string, patch: ContactPatch): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const row = cleanContact(patch);
  if (typeof row === "string") return { error: row };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_contacts").update(row).eq("id", id).select("first_name, last_name").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "crm.contact.update", { type: "crm_contact", id }, { name: [data.first_name, data.last_name].filter(Boolean).join(" "), fields: Object.keys(row) });
  refresh();
  return { ok: "Saved." };
}

// Moves leads along the lead lifecycle (e.g. drag on the Leads board).
export async function setLeadStatus(ids: string[], status: LeadStatus): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = uuids(ids);
  if (!targets.length || !isLeadStatus(status)) return { error: "Nothing to update." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_contacts").update({ lead_status: status }).in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.lead.status", { type: "crm_contact", id: targets[0] }, { count: targets.length, status });
  refresh();
  return { ok: targets.length > 1 ? `${targets.length} leads updated.` : "Updated." };
}

export async function deleteContacts(ids: string[]): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = uuids(ids);
  if (!targets.length) return { error: "Choose at least one contact." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_contacts").delete().in("id", targets).select("id");
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.contact.delete", { type: "crm_contact", id: targets[0] }, { count: data?.length ?? 0 });
  refresh();
  return { ok: `${data?.length ?? 0} deleted.` };
}

export type ImportRow = Partial<Record<"first_name" | "last_name" | "email" | "phone" | "title" | "company" | "source" | "address" | "city" | "state" | "zip" | "website" | "notes" | "tags", string>> & { details?: Record<string, string> };

// CSV and phone import: matches clients by name (creating missing ones),
// skips rows whose email or phone already exists, and keeps unmapped fields
// in `details`.
export async function importContacts(rows: ImportRow[], role: "contact" | "lead" = "contact"): Promise<Result> {
  await requireStaff("crm.manage");
  const input = (Array.isArray(rows) ? rows : []).slice(0, 2000);
  const supabase = await createClient();
  const emails = input.map((r) => email(r.email)).filter((e): e is string => Boolean(e));
  const { data: existing } = emails.length ? await supabase.from("crm_contacts").select("email").in("email", emails) : { data: [] };
  const taken = new Set((existing ?? []).map((e) => e.email));
  const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
  const { data: phones } = await supabase.from("crm_contacts").select("phone").not("phone", "is", null).limit(10000);
  const takenPhones = new Set((phones ?? []).map((p) => digits(p.phone)).filter((d) => d.length >= 7));

  const names = [...new Set(input.map((r) => text(r.company, 200)).filter((n): n is string => Boolean(n)))];
  const companyIds = new Map<string, string>();
  if (names.length) {
    const { data: found } = await supabase.from("crm_companies").select("id, name").in("name", names);
    for (const c of found ?? []) companyIds.set(c.name.toLowerCase(), c.id);
    const missing = names.filter((n) => !companyIds.has(n.toLowerCase()));
    if (missing.length) {
      const { data: made } = await supabase.from("crm_companies").insert(missing.map((name) => ({ name }))).select("id, name");
      for (const c of made ?? []) companyIds.set(c.name.toLowerCase(), c.id);
    }
  }

  const out = [];
  let skipped = 0;
  for (const r of input) {
    const first = text(r.first_name, 100) ?? (text(r.email, 200)?.split("@")[0] || null);
    const mail = email(r.email);
    const tel = digits(r.phone);
    if (!first || mail === false || (mail && taken.has(mail)) || (tel.length >= 7 && takenPhones.has(tel))) { skipped++; continue; }
    if (mail) taken.add(mail);
    if (tel.length >= 7) takenPhones.add(tel);
    const company = text(r.company, 200);
    const details = Object.fromEntries(Object.entries(r.details ?? {}).slice(0, 40).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 300)]));
    out.push({
      first_name: first, last_name: text(r.last_name, 100), email: mail, phone: text(r.phone, 40), title: text(r.title, 120),
      company_id: company ? companyIds.get(company.toLowerCase()) ?? null : null, source: text(r.source, 100) ?? "Import",
      address: text(r.address, 300), city: text(r.city, 100), state: text(r.state, 100), zip: text(r.zip, 20), website: text(r.website, 300), notes: text(r.notes, 10000),
      tags: list(r.tags), details, role, lead_status: role === "lead" ? "new" : null,
    });
  }
  if (out.length) {
    const { error } = await supabase.from("crm_contacts").insert(out);
    if (error) return { error: error.message };
  }
  await adminAudit(supabase, "crm.contact.import", { type: "crm_contact", id: "import" }, { imported: out.length, skipped, role });
  refresh();
  return { ok: `${out.length} imported${skipped ? `, ${skipped} skipped (already in Echo, or no name)` : ""}.` };
}

// A call, email, text, meeting or note that happened outside Echo.
export async function logActivity(input: {
  kind: string; direction?: string; subject?: string; body?: string; duration_minutes?: number; occurred_at?: string;
  company_id?: string | null; contact_id?: string | null; deal_id?: string | null;
}): Promise<Result> {
  await requireStaff("crm.manage");
  const kind = isActivityKind(input.kind) && input.kind !== "task" ? input.kind : "note";
  const row = {
    kind, body: text(input.body, 100000) ?? "", subject: text(input.subject, 300),
    direction: input.direction === "inbound" || input.direction === "outbound" ? input.direction : null,
    duration_seconds: input.duration_minutes ? Math.max(0, Math.round(Number(input.duration_minutes) * 60)) || null : null,
    occurred_at: input.occurred_at && !Number.isNaN(Date.parse(input.occurred_at)) ? new Date(input.occurred_at).toISOString() : new Date().toISOString(),
    company_id: ref(input.company_id), contact_id: ref(input.contact_id), deal_id: ref(input.deal_id),
  };
  if (!row.body && !row.subject) return { error: "Add a few words about what happened." };
  if (!row.company_id && !row.contact_id && !row.deal_id) return { error: "Not attached to a record." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_activities").insert(row).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, "crm.activity.create", { type: "crm_activity", id: data.id }, { kind, deal_id: row.deal_id, contact_id: row.contact_id });
  refresh();
  return { ok: "Logged.", id: data.id };
}
