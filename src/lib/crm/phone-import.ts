// Contacts straight off a phone, from Channel-Cast's lib/crm/phone-import.ts.
// Two ways in: the Contact Picker API (Chrome on Android opens the real
// contact sheet) and a vCard (.vcf) file, which every phone can export or
// share (iPhone: Contacts → select → Share). Parsing only; no DOM writes.

import type { ImportRow } from "@/lib/admin/actions/crm-people";

type Picked = { name?: string[]; email?: string[]; tel?: string[]; address?: { addressLine?: string[]; city?: string; region?: string; postalCode?: string; country?: string }[] };
type ContactsManager = { getProperties(): Promise<string[]>; select(props: string[], opts?: { multiple?: boolean }): Promise<Picked[]> };

export function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return nav.contacts && typeof nav.contacts.select === "function" && "ContactsManager" in window ? nav.contacts : null;
}

function splitName(full: string): Pick<ImportRow, "first_name" | "last_name"> {
  if (!/\p{L}/u.test(full)) return { first_name: full.trim() }; // a number saved as the name
  const [first, ...rest] = full.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") || undefined };
}

export function fromPicked(p: Picked): ImportRow {
  const tels = (p.tel ?? []).map((t) => t.trim()).filter(Boolean);
  const name = (p.name ?? []).map((n) => n.trim()).find(Boolean) ?? "";
  const addr = p.address?.[0];
  const details: Record<string, string> = {};
  if (tels[1]) details["Other phone"] = tels.slice(1).join(", ");
  if (addr?.country) details["Country"] = addr.country;
  return {
    ...(name ? splitName(name) : {}), email: p.email?.map((e) => e.trim()).find(Boolean), phone: tels[0],
    address: addr?.addressLine?.filter(Boolean).join(", ") || undefined, city: addr?.city || undefined, state: addr?.region || undefined,
    zip: addr?.postalCode || undefined, source: "Phone", details,
  };
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
const mobile = (l: VLine) => (l.params.type ?? []).some((t) => t === "CELL" || t === "MOBILE");
const SKIP = new Set(["BEGIN", "END", "VERSION", "PRODID", "REV", "UID", "PHOTO", "X-ABUID"]);

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
  const tels: string[] = [], emails: string[] = [];
  let fn = "";
  for (const l of lines) {
    switch (l.name) {
      case "FN": fn = value(l); break;
      case "N": { const [last, first] = parts(l); row.first_name = first || undefined; row.last_name = last || undefined; break; }
      case "ORG": { const [company, dept] = parts(l); row.company = company || undefined; if (dept) row.details!["Department"] = dept; break; }
      case "TITLE": case "ROLE": row.title ??= value(l) || undefined; break;
      case "TEL": { const t = value(l); if (t) { if (mobile(l)) tels.unshift(t); else tels.push(t); } break; }
      case "EMAIL": { const e = value(l); if (e) emails.push(e); break; }
      case "ADR": if (!row.city) { const [, , street, city, region, zip, country] = parts(l); Object.assign(row, { address: street || undefined, city: city || undefined, state: region || undefined, zip: zip || undefined }); if (country) row.details!["Country"] = country; } break;
      case "URL": row.website ??= value(l) || undefined; break;
      case "NOTE": row.notes = [row.notes, value(l)].filter(Boolean).join("\n") || undefined; break;
      case "CATEGORIES": row.tags = value(l); break;
      default: if (!SKIP.has(l.name) && !l.name.startsWith("X-") && value(l)) row.details![l.name.charAt(0) + l.name.slice(1).toLowerCase()] = value(l).slice(0, 300);
    }
  }
  if (!row.first_name && fn) Object.assign(row, splitName(fn));
  row.phone = tels[0];
  row.email = emails[0];
  if (tels.length > 1) row.details!["Other phone"] = tels.slice(1).join(", ");
  if (emails.length > 1) row.details!["Other email"] = emails.slice(1).join(", ");
  if (!row.first_name && !row.email && !row.phone) return null;
  if (!row.first_name) row.first_name = row.email?.split("@")[0] ?? row.phone;
  return row;
}

// ── Duplicates ──────────────────────────────────────────────────────────────
const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);

export type Candidate = { key: string; row: ImportRow; duplicate: { id: string; name: string; on: "email" | "phone" } | null };

export function toCandidates(rows: ImportRow[], existing: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null }[]): Candidate[] {
  const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
  const byPhone = new Map(existing.filter((c) => digits(c.phone).length >= 7).map((c) => [digits(c.phone), c]));
  return rows.map((row, i) => {
    const e = row.email ? byEmail.get(row.email.toLowerCase()) : undefined;
    const p = !e && digits(row.phone).length >= 7 ? byPhone.get(digits(row.phone)) : undefined;
    const hit = e ?? p;
    return { key: `c${i}`, row, duplicate: hit ? { id: hit.id, name: [hit.first_name, hit.last_name].filter(Boolean).join(" "), on: e ? "email" : "phone" } : null };
  });
}
