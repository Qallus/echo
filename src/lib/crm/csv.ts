// CSV import and export for contacts. Known columns map onto contact fields
// (by common header names); anything else is kept as an imported detail.

import type { ImportRow } from "@/lib/admin/actions/crm-people";
import { contactName, type Contact } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const FIELDS: Record<keyof Omit<ImportRow, "details">, RegExp> = {
  first_name: /^(first ?name|first|given ?name)$/,
  last_name: /^(last ?name|last|surname|family ?name)$/,
  email: /^(e-?mail|email ?address|work ?email)$/,
  phone: /^(phone|mobile|cell|phone ?number|telephone|direct ?phone)$/,
  title: /^(title|job ?title|position|role)$/,
  company: /^(company|company ?name|organization|organisation|account|employer)$/,
  source: /^(source|lead ?source)$/,
  address: /^(address|street|street ?address|address ?1)$/,
  city: /^(city|town)$/,
  zip: /^(zip|zip ?code|postal ?code|postcode)$/,
  state: /^(state|province|region)$/,
  website: /^(website|url|web ?site|company ?website)$/,
  notes: /^(notes?|description|comments?)$/,
  tags: /^(tags?|labels?)$/,
};

// Header row -> field per column ("name" splits into first and last).
export function mapHeaders(headers: string[]) {
  return headers.map((h) => {
    const k = h.trim().toLowerCase().replace(/[_-]+/g, " ");
    if (/^(name|full ?name|contact ?name)$/.test(k)) return "name" as const;
    return (Object.entries(FIELDS).find(([, re]) => re.test(k))?.[0] ?? null) as keyof typeof FIELDS | null;
  });
}

export function rowsToImport(rows: string[][]): ImportRow[] {
  const [headers, ...body] = rows;
  if (!headers) return [];
  const map = mapHeaders(headers);
  return body.map((cells) => {
    const out: ImportRow = { details: {} };
    cells.forEach((raw, i) => {
      const v = raw.trim();
      if (!v) return;
      const field = map[i];
      if (field === "name") { const [first, ...rest] = v.split(/\s+/); out.first_name = first; out.last_name = rest.join(" ") || undefined; }
      else if (field) out[field] = v;
      else if (headers[i]?.trim()) out.details![headers[i].trim()] = v;
    });
    return out;
  });
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function contactsToCsv(contacts: Contact[]) {
  const head = ["Name", "First name", "Last name", "Email", "Phone", "Title", "Company", "Role", "Lead status", "Source", "City", "State", "Website", "Tags"];
  const lines = contacts.map((c) => [contactName(c), c.first_name, c.last_name ?? "", c.email ?? "", c.phone ?? "", c.title ?? "", c.company?.name ?? "",
    c.role, c.lead_status ?? "", c.source ?? "", c.city ?? "", c.state ?? "", c.website ?? "", c.tags.join("; ")].map(esc).join(","));
  return [head.join(","), ...lines].join("\n");
}

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
