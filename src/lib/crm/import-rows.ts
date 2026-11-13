import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import { queueAutomations } from "@/lib/comms/automations";
import type { ContactAddress, Labeled } from "./types";
import { date, email, list, text, type Result } from "./validate";

// CSV, phone and MCP import. Matches clients by name (creating missing ones)
// and keeps unmapped fields in `details`. People already in Echo (same email
// or phone) are skipped, or with onDuplicate "fill" get what they're missing:
// empty fields, new phones, emails and addresses, a photo, a birthday, tags.

export type ImportRow = Partial<Record<"first_name" | "last_name" | "email" | "phone" | "title" | "company" | "source" | "address" | "city" | "state" | "zip" | "website" | "notes" | "tags" | "photo" | "birthday", string>> & {
  details?: Record<string, string>; phones?: Labeled[]; emails?: Labeled[]; addresses?: ContactAddress[];
};
export type ImportResult = Result & { imported?: number; updated?: number; skipped?: number };

const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
const label = (v: unknown) => text(v, 30)?.toLowerCase() ?? "other";

function photo(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 40000) return s;
  if (/^https:\/\/[^\s<>"'`]+$/.test(s) && s.length <= 500) return s;
  return null;
}
function phones(r: ImportRow): Labeled[] {
  const all = [...(r.phone ? [{ label: "mobile", value: r.phone }] : []), ...(Array.isArray(r.phones) ? r.phones : [])];
  const seen = new Set<string>();
  return all.flatMap((p) => {
    const v = text(p?.value, 40), d = digits(v);
    if (!v || d.length < 3 || seen.has(d)) return [];
    seen.add(d);
    return [{ label: label(p.label), value: v }];
  }).slice(0, 20);
}
function emails(r: ImportRow): Labeled[] {
  const all = [...(r.email ? [{ label: "home", value: r.email }] : []), ...(Array.isArray(r.emails) ? r.emails : [])];
  const seen = new Set<string>();
  return all.flatMap((e) => {
    const v = email(e?.value);
    if (!v || seen.has(v)) return [];
    seen.add(v);
    return [{ label: label(e.label), value: v }];
  }).slice(0, 20);
}
function addresses(r: ImportRow): ContactAddress[] {
  const list = Array.isArray(r.addresses) ? r.addresses : [];
  const all = list.length ? list : r.address || r.city ? [{ label: "home", street: r.address ?? "", city: r.city ?? "", state: r.state ?? "", zip: r.zip ?? "", country: "" }] : [];
  return all.flatMap((a) => {
    const out = { label: label(a?.label), street: text(a?.street, 300) ?? "", city: text(a?.city, 100) ?? "", state: text(a?.state, 100) ?? "", zip: text(a?.zip, 20) ?? "", country: text(a?.country, 60) ?? "" };
    return out.street || out.city || out.zip ? [out] : [];
  }).slice(0, 10);
}
const addrKey = (a: ContactAddress) => `${a.street} ${a.zip}`.toLowerCase().replace(/\W+/g, "");

// The columns added for phone imports (20261114090000). Dropped and retried if
// that database update hasn't been run yet, so imports still work.
const RICH = ["photo", "phones", "emails", "addresses", "birthday"] as const;
const missingColumn = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === "PGRST204" || e.code === "42703" || /column .* does not exist|schema cache/i.test(e.message ?? "")));
const plain = <T extends Record<string, unknown>>(row: T) => Object.fromEntries(Object.entries(row).filter(([k]) => !(RICH as readonly string[]).includes(k)));

type Existing = { id: string; email: string | null; phone: string | null };

export async function importContactRows(
  supabase: SupabaseClient, rows: ImportRow[], role: "contact" | "lead" = "contact", onDuplicate: "skip" | "fill" = "skip",
): Promise<ImportResult> {
  const input = (Array.isArray(rows) ? rows : []).slice(0, 2000);
  const { data: people } = await supabase.from("crm_contacts").select("id, email, phone").limit(20000);
  const byEmail = new Map<string, Existing>(), byPhone = new Map<string, Existing>();
  for (const p of (people ?? []) as Existing[]) {
    if (p.email) byEmail.set(p.email.toLowerCase(), p);
    if (digits(p.phone).length >= 7) byPhone.set(digits(p.phone), p);
  }

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

  const out: Record<string, unknown>[] = [];
  const fills = new Map<string, Record<string, unknown>>();
  let skipped = 0;
  for (const r of input) {
    const ph = phones(r), em = emails(r), ad = addresses(r);
    const first = text(r.first_name, 100) ?? (em[0]?.value.split("@")[0] || ph[0]?.value || null);
    if (!first) { skipped++; continue; }
    const company = text(r.company, 200);
    const row: Record<string, unknown> = {
      first_name: first, last_name: text(r.last_name, 100), email: em[0]?.value ?? null, phone: ph[0]?.value ?? null, title: text(r.title, 120),
      company_id: company ? companyIds.get(company.toLowerCase()) ?? null : null, source: text(r.source, 100) ?? "Import",
      address: ad[0]?.street || null, city: ad[0]?.city || null, state: ad[0]?.state || null, zip: ad[0]?.zip || null,
      website: text(r.website, 300), notes: text(r.notes, 10000), tags: list(r.tags),
      details: Object.fromEntries(Object.entries(r.details ?? {}).slice(0, 40).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 300)])),
      photo: photo(r.photo), phones: ph, emails: em, addresses: ad, birthday: date(r.birthday),
    };
    const match = em.map((e) => byEmail.get(e.value)).find(Boolean) ?? ph.map((p) => byPhone.get(digits(p.value))).find(Boolean);
    if (match) {
      if (onDuplicate === "fill") fills.set(match.id, row); else skipped++;
      continue;
    }
    // Same person twice in one import: the first one wins.
    const me: Existing = { id: "", email: row.email as string | null, phone: row.phone as string | null };
    em.forEach((e) => byEmail.set(e.value, me));
    ph.forEach((p) => digits(p.value).length >= 7 && byPhone.set(digits(p.value), me));
    out.push({ ...row, role, lead_status: role === "lead" ? "new" : null });
  }

  if (out.length) {
    let res = await supabase.from("crm_contacts").insert(out).select("id");
    if (missingColumn(res.error)) res = await supabase.from("crm_contacts").insert(out.map(plain)).select("id");
    if (res.error) return { error: res.error.message };
    if (role === "lead") await queueAutomations(supabase, "lead_created", (res.data ?? []).map((c) => ({ contactId: c.id })));
  }
  const updated = fills.size ? await fillIn(supabase, fills) : 0;
  await adminAudit(supabase, "crm.contact.import", { type: "crm_contact", id: "import" }, { imported: out.length, updated, skipped, role });
  const parts = [`${out.length} imported`, updated && `${updated} updated`, skipped && `${skipped} skipped (already in Echo, or no name)`].filter(Boolean);
  return { ok: `${parts.join(", ")}.`, imported: out.length, updated, skipped };
}

// Adds what an existing contact is missing; never overwrites what's there.
async function fillIn(supabase: SupabaseClient, fills: Map<string, Record<string, unknown>>): Promise<number> {
  let rich = true;
  let { data, error } = await supabase.from("crm_contacts").select("*").in("id", [...fills.keys()]);
  if (missingColumn(error)) { rich = false; ({ data, error } = await supabase.from("crm_contacts").select("*").in("id", [...fills.keys()])); }
  let n = 0;
  for (const cur of (data ?? []) as Record<string, unknown>[]) {
    const row = fills.get(cur.id as string)!;
    const patch: Record<string, unknown> = {};
    for (const k of ["last_name", "email", "phone", "title", "company_id", "address", "city", "state", "zip", "website", "notes", "photo", "birthday"]) {
      if (!cur[k] && row[k] && (rich || !(RICH as readonly string[]).includes(k))) patch[k] = row[k];
    }
    const tags = [...new Set([...((cur.tags as string[]) ?? []), ...(row.tags as string[])])].slice(0, 20);
    if (tags.length !== ((cur.tags as string[]) ?? []).length) patch.tags = tags;
    if (rich && "phones" in cur) {
      const have = (cur.phones as Labeled[]) ?? [];
      const known = new Set([digits(cur.phone as string), ...have.map((p) => digits(p.value))]);
      const add = (row.phones as Labeled[]).filter((p) => !known.has(digits(p.value)));
      if (add.length || (!have.length && cur.phone)) patch.phones = [...(have.length ? have : cur.phone ? [{ label: "mobile", value: cur.phone }] : []), ...add].slice(0, 20);
      const haveE = (cur.emails as Labeled[]) ?? [];
      const knownE = new Set([String(cur.email ?? "").toLowerCase(), ...haveE.map((e) => e.value.toLowerCase())]);
      const addE = (row.emails as Labeled[]).filter((e) => !knownE.has(e.value));
      if (addE.length) patch.emails = [...(haveE.length ? haveE : cur.email ? [{ label: "home", value: cur.email }] : []), ...addE].slice(0, 20);
      const haveA = (cur.addresses as ContactAddress[]) ?? [];
      const knownA = new Set(haveA.map(addrKey));
      const addA = (row.addresses as ContactAddress[]).filter((a) => !knownA.has(addrKey(a)));
      if (addA.length) patch.addresses = [...haveA, ...addA].slice(0, 10);
    }
    if (!Object.keys(patch).length) continue;
    const { error: e } = await supabase.from("crm_contacts").update(patch).eq("id", cur.id as string);
    if (!e) n++;
  }
  return n;
}
