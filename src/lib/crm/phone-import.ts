// Contacts straight off a phone. Two ways in:
//  - a contacts file (.vcf), which every phone can export: all contacts and
//    every field (photos, all numbers, company, groups, notes, birthdays);
//  - the phone's contact picker (Chrome on Android): pick specific people.
//    Browsers only share name, phone numbers, emails, addresses and photo.
// Parsing and field choices only; no DOM writes except drawing thumbnails.

import type { ImportRow } from "@/lib/admin/actions/crm-people";
import type { ContactAddress, Labeled } from "@/lib/crm/types";

// ── What to bring over ──────────────────────────────────────────────────────
export const FIELDS = [
  { id: "photo", label: "Profile photo", picker: true },
  { id: "phones", label: "All phone numbers", picker: true },
  { id: "emails", label: "All email addresses", picker: true },
  { id: "addresses", label: "Addresses", picker: true },
  { id: "company", label: "Company & job title", picker: false },
  { id: "groups", label: "Groups (as tags)", picker: false },
  { id: "notes", label: "Notes", picker: false },
  { id: "birthday", label: "Birthday", picker: false },
  { id: "websites", label: "Websites", picker: false },
  { id: "other", label: "Everything else (nickname, social…)", picker: false },
] as const;
export type FieldId = (typeof FIELDS)[number]["id"];
export const ALL_FIELDS = FIELDS.map((f) => f.id) as FieldId[];

// Keeps the name always, and only the chosen fields.
export function applyFields(r: ImportRow, keep: Set<FieldId>): ImportRow {
  const out: ImportRow = { first_name: r.first_name, last_name: r.last_name, source: r.source, details: {} };
  if (keep.has("photo")) out.photo = r.photo;
  if (keep.has("phones")) { out.phones = r.phones; out.phone = r.phones?.[0]?.value; }
  if (keep.has("emails")) { out.emails = r.emails; out.email = r.emails?.[0]?.value; }
  if (keep.has("addresses")) out.addresses = r.addresses;
  if (keep.has("company")) { out.company = r.company; out.title = r.title; if (r.details?.Department) out.details!.Department = r.details.Department; }
  if (keep.has("groups")) out.tags = r.tags;
  if (keep.has("notes")) out.notes = r.notes;
  if (keep.has("birthday")) { out.birthday = r.birthday; if (r.details?.Birthday) out.details!.Birthday = r.details.Birthday; }
  if (keep.has("websites")) { out.website = r.website; if (r.details?.["Other websites"]) out.details!["Other websites"] = r.details["Other websites"]; }
  if (keep.has("other")) for (const [k, v] of Object.entries(r.details ?? {})) if (!["Department", "Birthday", "Other websites"].includes(k)) out.details![k] = v;
  // Without any phone or email, keep the name only if it's all we have.
  if (!out.first_name) out.first_name = r.first_name ?? r.emails?.[0]?.value.split("@")[0] ?? r.phones?.[0]?.value;
  return out;
}

// What one row carries, for the review list.
export function summary(r: ImportRow): string {
  const p = r.phones?.length ?? 0, e = r.emails?.length ?? 0;
  return [
    r.phones?.[0]?.value && (p > 1 ? `${r.phones[0].value} (+${p - 1})` : r.phones[0].value),
    r.emails?.[0]?.value && (e > 1 ? `${r.emails[0].value} (+${e - 1})` : r.emails[0].value),
    r.company,
  ].filter(Boolean).join(" · ");
}

// ── The phone's contact picker ──────────────────────────────────────────────
type Picked = { name?: string[]; email?: string[]; tel?: string[]; icon?: Blob[]; address?: { addressLine?: string[]; city?: string; region?: string; postalCode?: string; country?: string }[] };
type ContactsManager = { getProperties(): Promise<string[]>; select(props: string[], opts?: { multiple?: boolean }): Promise<Picked[]> };

export function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return nav.contacts && typeof nav.contacts.select === "function" && "ContactsManager" in window ? nav.contacts : null;
}

// The picker properties for the chosen fields (name always).
export async function pickContacts(m: ContactsManager, keep: Set<FieldId>): Promise<ImportRow[]> {
  const supported = await m.getProperties().catch(() => [] as string[]);
  const want = ["name", keep.has("phones") && "tel", keep.has("emails") && "email", keep.has("addresses") && "address", keep.has("photo") && "icon"]
    .filter((p): p is string => Boolean(p))
    .filter((p) => !supported.length || supported.includes(p));
  const picked = await m.select(want, { multiple: true });
  return Promise.all(picked.map(fromPicked));
}

function splitName(full: string): Pick<ImportRow, "first_name" | "last_name"> {
  if (!/\p{L}/u.test(full)) return { first_name: full.trim() }; // a number saved as the name
  const [first, ...rest] = full.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") || undefined };
}

async function fromPicked(p: Picked): Promise<ImportRow> {
  const name = (p.name ?? []).map((n) => n.trim()).find(Boolean) ?? "";
  const phones = uniq((p.tel ?? []).map((t) => ({ label: "mobile", value: t.trim() })), (x) => x.value.replace(/\D/g, "").slice(-10));
  const emails = uniq((p.email ?? []).map((e) => ({ label: "home", value: e.trim().toLowerCase() })), (x) => x.value);
  const addresses: ContactAddress[] = (p.address ?? []).map((a) => ({
    label: "home", street: (a.addressLine ?? []).filter(Boolean).join(", "), city: a.city ?? "", state: a.region ?? "", zip: a.postalCode ?? "", country: a.country ?? "",
  })).filter((a) => a.street || a.city || a.zip);
  const photo = p.icon?.[0] ? await thumbnail(p.icon[0]) : undefined;
  return { ...(name ? splitName(name) : {}), phones, emails, addresses, photo, source: "Phone", details: {} };
}

const uniq = <T,>(xs: T[], key: (x: T) => string) => {
  const seen = new Set<string>();
  return xs.filter((x) => { const k = key(x); if (!k || seen.has(k)) return false; seen.add(k); return true; });
};

// ── Photos: shrunk to a 96px JPEG (about 3 KB) before they leave the phone ──
export async function thumbnail(src: Blob | string): Promise<string | undefined> {
  try {
    const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
    const bmp = await createImageBitmap(blob);
    const size = 96, s = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    bmp.close();
    const url = canvas.toDataURL("image/jpeg", 0.75);
    return url.length <= 40000 ? url : undefined;
  } catch {
    return undefined;
  }
}

// Turns each row's full-size vCard photo into a thumbnail (a few at a time).
export async function shrinkPhotos(rows: ImportRow[], onProgress?: (done: number) => void): Promise<ImportRow[]> {
  const out = [...rows];
  let done = 0;
  const jobs = out.map((r, i) => ({ r, i })).filter(({ r }) => r.photo?.startsWith("data:"));
  for (let k = 0; k < jobs.length; k += 8) {
    await Promise.all(jobs.slice(k, k + 8).map(async ({ r, i }) => { out[i] = { ...r, photo: await thumbnail(r.photo!) }; }));
    done = Math.min(jobs.length, k + 8);
    onProgress?.(done);
  }
  return out;
}

// ── vCard 2.1 / 3.0 / 4.0 ──────────────────────────────────────────────────
type VLine = { name: string; params: Record<string, string[]>; value: string };

// Rejoins folded lines (leading space/tab, or a quoted-printable "=" break).
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const prev = out.at(-1);
    if (prev !== undefined && /^[ \t]/.test(line)) out[out.length - 1] = prev + line.slice(1);
    else if (prev !== undefined && prev.endsWith("=") && /QUOTED-PRINTABLE/i.test(prev)) out[out.length - 1] = prev.slice(0, -1) + line;
    // vCard 2.1 base64 photos continue on unindented lines until a blank line.
    else if (prev !== undefined && line && /^PHOTO[;:]/i.test(prev) && /ENCODING=(B|BASE64)/i.test(prev) && /^[A-Za-z0-9+/=]+$/.test(line)) out[out.length - 1] = prev + line;
    else out.push(line);
  }
  return out;
}

function splitUnquoted(s: string, sep: string) {
  const parts: string[] = [];
  let cur = "", quoted = false;
  for (const ch of s) {
    if (ch === '"') { quoted = !quoted; cur += ch; } else if (ch === sep && !quoted) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function parseLine(line: string): VLine | null {
  let colon = -1, quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) { colon = i; break; }
  }
  if (colon < 0) return null;
  const segs = splitUnquoted(line.slice(0, colon), ";");
  let name = segs[0].trim();
  if (name.includes(".")) name = name.slice(name.indexOf(".") + 1);
  if (!name) return null;
  const params: Record<string, string[]> = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq < 0) (params.type ||= []).push(seg.trim().toUpperCase());
    else for (const v of splitUnquoted(seg.slice(eq + 1), ",")) (params[seg.slice(0, eq).trim().toLowerCase()] ||= []).push(v.replace(/^"|"$/g, "").trim().toUpperCase());
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function raw(line: VLine) {
  if (!/QUOTED-PRINTABLE/i.test((line.params.encoding ?? []).join(" "))) return line.value;
  const bytes: number[] = [];
  for (let i = 0; i < line.value.length; i++) {
    if (line.value[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(line.value.slice(i + 1, i + 3))) { bytes.push(parseInt(line.value.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(line.value.charCodeAt(i));
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}
const value = (l: VLine) => raw(l).replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
function parts(l: VLine) {
  const s = raw(l), out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) { cur += /n/i.test(s[i + 1]) ? "\n" : s[i + 1]; i++; }
    else if (s[i] === ";") { out.push(cur); cur = ""; } else cur += s[i];
  }
  out.push(cur);
  return out.map((p) => p.trim());
}

// "mobile", "work", "home", "fax", "main", "other" from TYPE=...
function labelOf(l: VLine, fallback: string) {
  const t = (l.params.type ?? []).filter((x) => x !== "PREF" && x !== "VOICE" && x !== "INTERNET" && x !== "X400");
  if (t.some((x) => x === "CELL" || x === "MOBILE" || x === "IPHONE")) return "mobile";
  if (t.includes("FAX")) return "fax";
  if (t.includes("PAGER")) return "pager";
  if (t.includes("MAIN")) return "main";
  if (t.includes("WORK")) return "work";
  if (t.includes("HOME")) return "home";
  return t[0]?.startsWith("X-") ? t[0].slice(2).toLowerCase() : fallback;
}
const preferred = (l: VLine) => (l.params.type ?? []).includes("PREF") || (l.params.pref ?? []).length > 0;

function photoOf(l: VLine): string | undefined {
  const v = l.value.trim();
  if (/^data:image\//i.test(v)) return v;
  if (/^https:\/\//i.test(v)) return v.slice(0, 500);
  const enc = (l.params.encoding ?? []).join(" ");
  if (/^(B|BASE64)$/.test(enc) || /^[A-Za-z0-9+/=]{100,}$/.test(v)) {
    const t = (l.params.type ?? []).find((x) => /JPE?G|PNG|GIF|WEBP/.test(x)) ?? "JPEG";
    return `data:image/${t === "JPG" ? "jpeg" : t.toLowerCase()};base64,${v.replace(/\s+/g, "")}`;
  }
  return undefined;
}

function birthdayOf(s: string): { date?: string; text?: string } {
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m && m[1] !== "1604" && m[1] !== "0000") return { date: `${m[1]}-${m[2]}-${m[3]}` }; // 1604: iPhone's "no year"
  const d = s.match(/^(?:--|\d{4}-?)(\d{2})-?(\d{2})/);
  if (d) return { text: new Date(2000, Number(d[1]) - 1, Number(d[2])).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  return {};
}

const SKIP = new Set(["BEGIN", "END", "VERSION", "PRODID", "REV", "UID", "X-ABUID", "X-ABLABEL", "KIND", "SOURCE", "CLIENTPIDMAP", "LOGO", "SOUND", "KEY"]);
const HIDDEN_GROUPS = /^(mycontacts|starred|my contacts|\*starred)$/i;

export function parseVCards(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  let cur: VLine[] | null = null;
  for (const l of unfold(text)) {
    const line = parseLine(l);
    if (!line) continue;
    if (line.name === "BEGIN" && /VCARD/i.test(line.value)) { cur = []; continue; }
    if (line.name === "END" && /VCARD/i.test(line.value)) { if (cur) { const r = build(cur); if (r) rows.push(r); } cur = null; continue; }
    cur?.push(line);
  }
  if (cur) { const r = build(cur); if (r) rows.push(r); }
  return rows;
}

function build(lines: VLine[]): ImportRow | null {
  const row: ImportRow = { source: "Phone", details: {} };
  const phones: (Labeled & { pref: boolean })[] = [], emails: (Labeled & { pref: boolean })[] = [], addresses: ContactAddress[] = [];
  const sites: string[] = [], groups: string[] = [];
  let fn = "";
  for (const l of lines) {
    switch (l.name) {
      case "FN": fn = value(l); break;
      case "N": { const [last, first, middle] = parts(l); row.first_name = first || undefined; row.last_name = [middle, last].filter(Boolean).join(" ") || undefined; break; }
      case "ORG": { const [company, dept] = parts(l); row.company = company || undefined; if (dept) row.details!.Department = dept; break; }
      case "TITLE": case "ROLE": row.title ??= value(l) || undefined; break;
      case "TEL": { const v = value(l).replace(/^tel:/i, ""); if (v) phones.push({ label: labelOf(l, "mobile"), value: v, pref: preferred(l) }); break; }
      case "EMAIL": { const v = value(l).replace(/^mailto:/i, "").toLowerCase(); if (v) emails.push({ label: labelOf(l, "home"), value: v, pref: preferred(l) }); break; }
      case "ADR": {
        const [, ext, street, city, region, zip, country] = parts(l);
        const a = { label: labelOf(l, "home"), street: [street, ext].filter(Boolean).join(", "), city: city ?? "", state: region ?? "", zip: zip ?? "", country: country ?? "" };
        if (a.street || a.city || a.zip) addresses.push(a);
        break;
      }
      case "URL": { const v = value(l); if (v) sites.push(v); break; }
      case "NOTE": row.notes = [row.notes, value(l)].filter(Boolean).join("\n") || undefined; break;
      case "CATEGORIES": groups.push(...value(l).split(",").map((g) => g.trim()).filter((g) => g && !HIDDEN_GROUPS.test(g))); break;
      case "PHOTO": row.photo ??= photoOf(l); break;
      case "BDAY": { const b = birthdayOf(value(l)); if (b.date) row.birthday = b.date; else if (b.text) row.details!.Birthday = b.text; break; }
      case "NICKNAME": if (value(l)) row.details!.Nickname = value(l).slice(0, 300); break;
      case "X-SOCIALPROFILE": case "IMPP": { const v = value(l); if (v) row.details![`${labelOf(l, "Social")[0].toUpperCase()}${labelOf(l, "social").slice(1)} profile`] = v.slice(0, 300); break; }
      default: if (!SKIP.has(l.name) && !l.name.startsWith("X-") && value(l)) row.details![l.name.charAt(0) + l.name.slice(1).toLowerCase()] = value(l).slice(0, 300);
    }
  }
  if (!row.first_name && fn) Object.assign(row, splitName(fn));
  // Preferred (or mobile) first: that becomes the main number and email.
  const order = <T extends { pref: boolean; label: string }>(xs: T[]) => [...xs].sort((a, b) => Number(b.pref) - Number(a.pref) || Number(b.label === "mobile") - Number(a.label === "mobile"));
  row.phones = uniq(order(phones), (x) => x.value.replace(/\D/g, "").slice(-10)).map(({ label, value }) => ({ label, value }));
  row.emails = uniq(order(emails), (x) => x.value).map(({ label, value }) => ({ label, value }));
  row.addresses = addresses;
  row.phone = row.phones[0]?.value;
  row.email = row.emails[0]?.value;
  row.website = sites[0];
  if (sites.length > 1) row.details!["Other websites"] = sites.slice(1).join(", ").slice(0, 300);
  if (groups.length) row.tags = [...new Set(groups)].join(", ");
  if (!row.first_name && !row.email && !row.phone) return null;
  if (!row.first_name) row.first_name = row.email?.split("@")[0] ?? row.phone;
  return row;
}

// ── Duplicates ──────────────────────────────────────────────────────────────
const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);

export type Candidate = { key: string; row: ImportRow; duplicate: { id: string; name: string; on: "email" | "phone" } | null };

type Known = { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; emails?: Labeled[]; phones?: Labeled[] };

export function toCandidates(rows: ImportRow[], existing: Known[]): Candidate[] {
  const byEmail = new Map<string, Known>(), byPhone = new Map<string, Known>();
  for (const c of existing) {
    for (const e of [c.email, ...(c.emails ?? []).map((x) => x.value)]) if (e) byEmail.set(e.toLowerCase(), c);
    for (const p of [c.phone, ...(c.phones ?? []).map((x) => x.value)]) if (digits(p).length >= 7) byPhone.set(digits(p), c);
  }
  return rows.map((row, i) => {
    const e = (row.emails ?? []).map((x) => byEmail.get(x.value.toLowerCase())).find(Boolean);
    const p = e ? undefined : (row.phones ?? []).map((x) => (digits(x.value).length >= 7 ? byPhone.get(digits(x.value)) : undefined)).find(Boolean);
    const hit = e ?? p;
    return { key: `c${i}`, row, duplicate: hit ? { id: hit.id, name: [hit.first_name, hit.last_name].filter(Boolean).join(" "), on: e ? "email" : "phone" } : null };
  });
}
