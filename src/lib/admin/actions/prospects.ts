"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { adminAudit } from "@/lib/admin/audit";
import { geocode } from "@/lib/crm/geocode";
import { requireStaff } from "@/lib/admin/guard";
import { uuids, type Result } from "@/lib/crm/validate";
import { lookupsFor } from "@/lib/prospects/data";
import type { ProspectImportRow } from "@/lib/prospects/import";
import { prospectE164 } from "@/lib/prospects/phone";
import { scoreProspect } from "@/lib/prospects/score";
import { isProspectStatus, type ProspectStatus } from "@/lib/prospects/types";
import { createClient } from "@/lib/supabase/server";

// Admin -> Prospects: import, status changes and deletes (crm.manage,
// audited). Running Twilio lookups is separate (prospects.run).

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const refresh = () => revalidatePath("/admin/prospects");

export async function importProspects(rows: ProspectImportRow[], source: "csv" | "paste" | "manual"): Promise<Result & { added?: number; duplicates?: number; invalid?: number }> {
  await requireStaff("crm.manage");
  if (!Array.isArray(rows) || !rows.length) return { error: "Nothing to import." };
  if (rows.length > 5000) return { error: "Import up to 5,000 numbers at a time." };
  let invalid = 0;
  const clean = new Map<string, ReturnType<typeof toRow>>();
  for (const r of rows) {
    const phone = prospectE164(String(r?.phone ?? ""));
    if (!phone) { invalid++; continue; }
    if (!clean.has(phone)) clean.set(phone, toRow(r, phone, source === "csv" || source === "manual" ? source : "paste"));
  }
  const supabase = await createClient();
  const phones = [...clean.keys()];
  // Skip numbers already on the list.
  const existing = new Set<string>();
  for (let i = 0; i < phones.length; i += 300) {
    const { data, error } = await supabase.from("prospects").select("phone_e164").is("workspace_id", null).in("phone_e164", phones.slice(i, i + 300));
    if (error) return { error: error.message };
    for (const p of data ?? []) existing.add(p.phone_e164);
  }
  const fresh = phones.filter((p) => !existing.has(p)).map((p) => clean.get(p)!);
  // Numbers looked up before (for anyone) are scored right away.
  const lookups = await lookupsFor(supabase, fresh.map((r) => r.phone_e164));
  for (const r of fresh) {
    const l = lookups.get(r.phone_e164);
    r.score = scoreProspect({ provider: l?.provider ?? null, confidence: l?.confidence ?? null, category: r.category, city: r.city, website: r.website, status: "new" });
  }
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase.from("prospects").insert(fresh.slice(i, i + 500));
    if (error) return { error: error.message };
  }
  await adminAudit(supabase, "prospects.import", undefined, { added: fresh.length, duplicates: existing.size, invalid, source });
  // Put the new ones on the map in the background.
  if (fresh.length) after(() => placeProspects(supabase).catch(() => {}));
  refresh();
  const parts = [`${fresh.length} added`, existing.size ? `${existing.size} already on the list` : "", invalid ? `${invalid} not valid numbers` : ""].filter(Boolean);
  return { ok: `${parts.join(", ")}.`, added: fresh.length, duplicates: existing.size, invalid };
}

function toRow(r: ProspectImportRow, phone: string, source: "csv" | "paste" | "manual") {
  return {
    phone_e164: phone, source, business_name: clip(r.business_name, 200), website: clip(r.website, 300), address: clip(r.address, 300),
    city: clip(r.city, 100), state: clip(r.state, 60), category: clip(r.category, 100), score: 0 as number,
  };
}

// Status for one or many prospects. Do not contact is permanent.
export async function setProspectStatus(ids: string[], status: ProspectStatus): Promise<Result> {
  await requireStaff("crm.manage");
  const list = uuids(ids);
  if (!list.length || !isProspectStatus(status)) return { error: "Nothing to change." };
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("prospects").select("id, phone_e164, status, category, city, website").in("id", list);
  if (error) return { error: error.message };
  const editable = (rows ?? []).filter((r) => r.status !== "dnc" || status === "dnc");
  const lookups = await lookupsFor(supabase, editable.map((r) => r.phone_e164));
  for (const r of editable) {
    const l = lookups.get(r.phone_e164);
    const score = scoreProspect({ provider: l?.provider ?? null, confidence: l?.confidence ?? null, category: r.category, city: r.city, website: r.website, status });
    const { error: e } = await supabase.from("prospects").update({ status, score }).eq("id", r.id);
    if (e) return { error: e.message };
  }
  await adminAudit(supabase, "prospects.status", undefined, { count: editable.length, status });
  refresh();
  const locked = (rows?.length ?? 0) - editable.length;
  return { ok: `${editable.length} updated.${locked ? ` ${locked} marked Do not contact stayed that way.` : ""}` };
}

export async function updateProspectNotes(id: string, notes: string): Promise<Result> {
  await requireStaff("crm.manage");
  const [one] = uuids([id]);
  if (!one) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ notes: clip(notes, 5000) }).eq("id", one);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Saved." };
}

export async function deleteProspects(ids: string[]): Promise<Result> {
  await requireStaff("crm.manage");
  const list = uuids(ids);
  if (!list.length) return { error: "Nothing selected." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospects").delete().in("id", list).select("id");
  if (error) return { error: error.message };
  await adminAudit(supabase, "prospects.delete", undefined, { count: data?.length ?? 0 });
  refresh();
  return { ok: `${data?.length ?? 0} deleted.` };
}

// Place prospects on the map: one OpenStreetMap search per distinct place
// (street address when there is one, else city and state), about a second
// each, up to 40 places a run. Rows that can't be placed are marked tried.
async function placeProspects(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("prospects").select("id, address, city, state").is("workspace_id", null).is("geocoded_at", null).limit(2000);
  const groups = new Map<string, string[]>();
  for (const p of data ?? []) {
    const q = [p.address, p.city, p.state].filter(Boolean).join(", ");
    if (!p.city && !p.address) continue;
    groups.set(q, [...(groups.get(q) ?? []), p.id]);
  }
  for (const [q, ids] of [...groups].slice(0, 40)) {
    const hit = await geocode(`${q}, USA`);
    for (let i = 0; i < ids.length; i += 300) {
      await supabase.from("prospects").update({ latitude: hit?.lat ?? null, longitude: hit?.lng ?? null, geocoded_at: new Date().toISOString() }).in("id", ids.slice(i, i + 300));
    }
  }
}

// Map prospects that weren't placed yet (the button in the wizard).
export async function mapProspects(): Promise<Result> {
  await requireStaff("crm.manage");
  const supabase = await createClient();
  await placeProspects(supabase);
  refresh();
  return { ok: "Placed what could be found on the map." };
}
