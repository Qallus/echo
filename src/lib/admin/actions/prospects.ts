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
import { estimate, processChunk, startRun, type Estimate, type RunProgress } from "@/lib/prospects/runner";
import { readProspecting, type ProspectingSettings } from "@/lib/prospects/settings";
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
  return { phone_e164: phone, source, ...details(r), score: 0 as number };
}

// The editable details, cleaned. Newer columns are only included when given,
// so imports still work on a database without migration 20261122110000.
function details(r: Partial<ProspectImportRow>) {
  const ext = clip(r.phone_ext, 8);
  const count = Number(clip(r.locations, 6) ?? "");
  const mail = clip(r.email, 200)?.toLowerCase() ?? null;
  const extra = {
    contact_first_name: clip(r.contact_first_name, 100), contact_last_name: clip(r.contact_last_name, 100), contact_title: clip(r.contact_title, 120),
    email: mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? mail : null, phone_ext: ext && /^[0-9]{1,8}$/.test(ext) ? ext : null,
    address2: clip(r.address2, 100), zip: clip(r.zip, 20), country: clip(r.country, 60),
    locations: Number.isInteger(count) && count >= 1 && count <= 100000 ? count : null,
    tags: [...new Set((r.tags ?? "").split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20),
  };
  return {
    business_name: clip(r.business_name, 200), website: clip(r.website, 300), address: clip(r.address, 300),
    city: clip(r.city, 100), state: clip(r.state, 60), category: clip(r.category, 100), notes: clip(r.notes, 5000),
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length))),
  };
}

// Edit one prospect (the Edit panel). The phone number stays fixed.
export async function updateProspect(id: string, input: Partial<ProspectImportRow>): Promise<Result> {
  await requireStaff("crm.manage");
  const [one] = uuids([id]);
  if (!one) return { error: "Not found." };
  const supabase = await createClient();
  const d = details(input);
  // Clearing a field: send null for the newer columns that were left empty.
  const cleared = ["contact_first_name", "contact_last_name", "contact_title", "email", "phone_ext", "address2", "zip", "country", "locations"]
    .filter((k) => !(k in d)).reduce<Record<string, null>>((acc, k) => ({ ...acc, [k]: null }), {});
  const { data: cur } = await supabase.from("prospects").select("phone_e164, status, address, city, state").eq("id", one).maybeSingle();
  if (!cur) return { error: "Not found." };
  const lookups = await lookupsFor(supabase, [cur.phone_e164]);
  const l = lookups.get(cur.phone_e164);
  const score = scoreProspect({ provider: l?.provider ?? null, confidence: l?.confidence ?? null, category: d.category, city: d.city, website: d.website, status: cur.status });
  const moved = cur.address !== d.address || cur.city !== d.city || cur.state !== d.state;
  const { error } = await supabase.from("prospects").update({ ...d, ...cleared, tags: (d as { tags?: string[] }).tags ?? [], score, ...(moved ? { geocoded_at: null, latitude: null, longitude: null } : {}) }).eq("id", one);
  if (error) return { error: /does not exist|schema cache/i.test(error.message) ? "Run supabase/migrations/20261122110000_prospects_details.sql first, then try again." : error.message };
  await adminAudit(supabase, "prospects.update", { type: "prospect", id: one }, { name: d.business_name });
  if (moved) after(() => placeProspects(supabase).catch(() => {}));
  refresh();
  return { ok: "Saved." };
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

// ---------------------------------------------------------------------------
// Twilio lookups (prospects.run: owner and admin). Every run shows its cost
// first and is audited when it starts and when it finishes.
// ---------------------------------------------------------------------------
export async function estimateLookup(ids: string[] | null, callerName: boolean): Promise<{ est?: Estimate; error?: string }> {
  await requireStaff("prospects.run");
  const list = ids ? uuids(ids) : null;
  if (ids && !list?.length) return { error: "Nothing selected." };
  return { est: await estimate(await createClient(), list, Boolean(callerName)) };
}

export async function startLookup(ids: string[] | null, callerName: boolean): Promise<{ runId?: string; error?: string; cached?: number }> {
  await requireStaff("prospects.run");
  const list = ids ? uuids(ids) : null;
  if (ids && !list?.length) return { error: "Nothing selected." };
  const supabase = await createClient();
  const r = await startRun(supabase, list, Boolean(callerName));
  if (r.error || !r.runId) return { error: r.error ?? "Couldn't start." };
  await adminAudit(supabase, "prospects.lookup.start", { type: "lookup_run", id: r.runId }, {
    numbers: r.est?.toLookUp, cached: r.est?.cached, est_cost_cents: r.est?.estCents, caller_name: Boolean(callerName),
  });
  refresh();
  return { runId: r.runId, cached: r.est?.cached };
}

export async function processLookup(runId: string): Promise<{ progress?: RunProgress; error?: string }> {
  await requireStaff("prospects.run");
  const [id] = uuids([runId]);
  if (!id) return { error: "Not found." };
  const supabase = await createClient();
  const progress = await processChunk(supabase, id);
  if (progress.done && progress.handled) {
    await adminAudit(supabase, "prospects.lookup.done", { type: "lookup_run", id }, { processed: progress.processed, failed: progress.failed, cost_cents: progress.costCents });
    refresh();
  }
  return { progress };
}

export async function saveProspectingSettings(input: ProspectingSettings): Promise<Result> {
  await requireStaff("settings.manage");
  const value = readProspecting(input);
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "prospecting", value });
  if (error) return { error: error.message };
  await adminAudit(supabase, "settings.prospecting.save", { type: "setting", id: "prospecting" }, value);
  refresh();
  return { ok: "Saved." };
}
