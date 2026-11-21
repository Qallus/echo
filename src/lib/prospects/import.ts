import { parseCsv } from "@/lib/crm/csv";
import { prospectE164 } from "./phone";

// Turn an uploaded CSV, or pasted lines, into prospect rows. Only the phone
// is required. CSV headers map by common names; pasted lines can be just a
// number, or "Business name, number" in any order.

export type ProspectImportRow = {
  business_name?: string; phone: string; website?: string; address?: string; city?: string; state?: string; category?: string;
  contact_first_name?: string; contact_last_name?: string; contact_title?: string; email?: string; phone_ext?: string;
  address2?: string; zip?: string; country?: string; locations?: string; tags?: string; notes?: string;
  provider_override?: string; provider_note?: string;
};
type Key = keyof ProspectImportRow;

const HEADERS: Record<Key, RegExp> = {
  business_name: /^(business|business ?name|company|company ?name|name|organization|account)$/,
  phone: /^(phone|phone ?number|telephone|tel|number|main ?phone|business ?phone)$/,
  website: /^(website|web ?site|url|domain|site)$/,
  address: /^(address|street|street ?address|address ?1)$/,
  city: /^(city|town)$/,
  state: /^(state|province|region)$/,
  category: /^(category|industry|type|vertical|segment|niche)$/,
  contact_first_name: /^(first ?name|first|contact ?first ?name|owner ?first ?name)$/,
  contact_last_name: /^(last ?name|last|surname|contact ?last ?name|owner ?last ?name)$/,
  contact_title: /^(title|job ?title|position|role)$/,
  email: /^(e-?mail|email ?address|work ?email|contact ?email)$/,
  phone_ext: /^(ext|ext\.|extension|phone ?ext)$/,
  address2: /^(suite|unit|ste|address ?2|apt|building|floor)$/,
  zip: /^(zip|zip ?code|postal ?code|postcode)$/,
  country: /^(country)$/,
  locations: /^(locations|number ?of ?locations|# ?locations|branches)$/,
  tags: /^(tags|labels)$/,
  notes: /^(notes|note|comments)$/,
  provider_override: /^(provider|phone ?provider|phone ?system|current ?provider)$/,
  provider_note: /^(provider ?notes?|phone ?notes?)$/,
};

export function mapProspectHeaders(headers: string[]): (Key | null)[] {
  const used = new Set<Key>();
  return headers.map((h) => {
    const k = (Object.keys(HEADERS) as Key[]).find((key) => !used.has(key) && HEADERS[key].test(h.trim().toLowerCase()));
    if (k) used.add(k);
    return k ?? null;
  });
}

const looksLikePhone = (s: string) => /\d/.test(s) && s.replace(/[^\d]/g, "").length >= 10 && s.replace(/[\d\s()+.\-]/g, "").length === 0;

export function parseProspects(text: string): { rows: ProspectImportRow[]; invalid: number; mapped: (Key | null)[] | null; source: "csv" | "paste" } {
  const table = parseCsv(text.trim());
  if (!table.length) return { rows: [], invalid: 0, mapped: null, source: "paste" };
  const mapped = mapProspectHeaders(table[0]);
  const isCsv = mapped.includes("phone");
  const rows: ProspectImportRow[] = [];
  let invalid = 0;
  for (const cells of isCsv ? table.slice(1) : table) {
    let row: Partial<ProspectImportRow> = {};
    if (isCsv) {
      mapped.forEach((k, i) => { const v = cells[i]?.trim(); if (k && v) row[k] = v.slice(0, k === "website" || k === "address" ? 300 : 200); });
    } else {
      const parts = cells.map((c) => c.trim()).filter(Boolean);
      const phone = parts.find(looksLikePhone);
      row = { phone: phone ?? "", business_name: parts.filter((p) => p !== phone).join(" ").slice(0, 200) || undefined };
    }
    const e164 = row.phone ? prospectE164(row.phone) : null;
    if (!e164) { invalid++; continue; }
    rows.push({ ...row, phone: e164 } as ProspectImportRow);
  }
  // The same number twice in one file counts once.
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.phone) ? false : (seen.add(r.phone), true)));
  return { rows: unique, invalid, mapped: isCsv ? mapped : null, source: isCsv ? "csv" : "paste" };
}
