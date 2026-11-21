import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queueAutomations } from "@/lib/comms/automations";
import { effectiveProvider, PROVIDERS, TALK_TRACKS, type Provider } from "./carriers";
import { lookupsFor } from "./data";
import { scoreProspect } from "./score";

// Prospects -> CRM leads, carrying everything over:
// - every matching field (business, contact person, email, phone and
//   extension, website, full address, locations);
// - notes, plus the phone provider (what you confirmed, else the lookup),
//   your provider details, the carrier holding the number, and the talk track;
// - the rest under the contact's details (category, score, line type,
//   caller name, when it was looked up and added);
// - tags for targeting: source:carrier-lookup, provider:<bucket>, the
//   category, and the prospect's own tags.
// A number already in the CRM is linked and filled in (blanks only, never
// overwriting), not duplicated. Do-not-contact prospects are never converted.

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
const PARA = "\n\n";

type Row = {
  id: string; business_name: string | null; phone_e164: string; website: string | null; address: string | null; city: string | null;
  state: string | null; category: string | null; status: string; notes: string | null; crm_contact_id: string | null;
  contact_first_name?: string | null; contact_last_name?: string | null; contact_title?: string | null; email?: string | null;
  phone_ext?: string | null; address2?: string | null; zip?: string | null; country?: string | null; locations?: number | null; tags?: string[];
  provider_override?: string | null; provider_note?: string | null; source?: string; created_at?: string;
};

export type ConvertResult = { contactIds: string[]; created: number; linked: number; skippedDnc: number; error?: string; byProspect: Map<string, string> };

export async function prospectsToLeads(db: SupabaseClient, ids: string[]): Promise<ConvertResult> {
  const out: ConvertResult = { contactIds: [], created: 0, linked: 0, skippedDnc: 0, byProspect: new Map() };
  const { data, error } = await db.from("prospects").select("*").is("workspace_id", null).in("id", ids);
  if (error) return { ...out, error: error.message };
  const rows = (data ?? []) as Row[];
  const lookups = await lookupsFor(db, rows.map((r) => r.phone_e164));
  const fresh: string[] = [];

  for (const p of rows) {
    if (p.status === "dnc") { out.skippedDnc++; continue; }
    const l = lookups.get(p.phone_e164) ?? null;
    const eff = effectiveProvider(l, p.provider_override);
    const provider = eff.provider;
    const score = scoreProspect({ provider, confidence: eff.confidence, category: p.category, city: p.city, website: p.website, status: p.status });
    const providerText = provider
      ? `${PROVIDERS[provider].label}${eff.byYou ? " (confirmed)" : eff.confidence === "possible" ? " (possible, from lookup)" : " (from lookup)"}`
      : null;
    const tags = [...new Set([
      "source:carrier-lookup", provider && `provider:${provider}`, p.category && slug(p.category), ...(p.tags ?? []),
    ].filter(Boolean) as string[])].slice(0, 20);
    const details = Object.fromEntries(Object.entries({
      "Prospect category": p.category, "Prospect score": String(score), "Phone provider": providerText,
      "Phone provider details": p.provider_note, "Number held by (carrier)": l?.carrier_name, "Line type": l?.line_type,
      "Caller name on file": l?.caller_name, "Looked up": l?.looked_up_at?.slice(0, 10), "Prospect source": p.source,
      "Prospect added": p.created_at?.slice(0, 10),
    }).filter(([, v]) => v)) as Record<string, string>;
    const talk = provider ? TALK_TRACKS[provider] : undefined;
    const providerLine = provider
      ? `Phone provider: ${providerText}${p.provider_note ? `: ${p.provider_note}` : ""}.${l?.carrier_name ? ` Number held by ${l.carrier_name}${l.line_type ? ` (${l.line_type})` : ""}.` : ""}`
      : null;
    const notes = [p.notes, providerLine, talk && `Talk track: ${talk}`].filter(Boolean).join(PARA).slice(0, 10000) || null;

    // Already linked, or the number is already in the CRM: fill it in and link.
    let contactId = p.crm_contact_id;
    if (!contactId) {
      const { data: hit } = await db.from("crm_contacts").select("id").eq("phone", p.phone_e164).limit(1).maybeSingle();
      contactId = hit?.id ?? null;
    }
    if (contactId) {
      const { data: cur } = await db.from("crm_contacts").select("*").eq("id", contactId).maybeSingle();
      if (cur) {
        const fill = Object.fromEntries(Object.entries(fields(p, provider)).filter(([k, v]) => v != null && v !== "" && (cur[k] == null || cur[k] === "")));
        const addNotes = [p.notes, providerLine].filter((n): n is string => Boolean(n) && !(cur.notes ?? "").includes(n as string));
        const { error: e } = await db.from("crm_contacts").update({
          ...fill, tags: [...new Set([...(cur.tags ?? []), ...tags])].slice(0, 20), details: { ...(cur.details ?? {}), ...details },
          ...(cur.lead_status ? {} : { lead_status: "new" }),
          ...(addNotes.length ? { notes: [cur.notes, ...addNotes].filter(Boolean).join(PARA).slice(0, 10000) } : {}),
        }).eq("id", contactId);
        if (e) return { ...out, error: e.message };
        out.linked++;
        out.byProspect.set(p.id, contactId);
        out.contactIds.push(contactId);
        continue;
      }
    }

    const { data: made, error: e } = await db.from("crm_contacts")
      .insert({ ...fields(p, provider), role: "lead", lead_status: "new", tags, notes, details }).select("id").single();
    if (e || !made) return { ...out, error: e?.message ?? "Couldn't create the lead." };
    out.created++;
    out.byProspect.set(p.id, made.id);
    out.contactIds.push(made.id);
    fresh.push(made.id);
  }

  // Link each prospect to its lead.
  for (const [prospectId, contactId] of out.byProspect) await db.from("prospects").update({ crm_contact_id: contactId }).eq("id", prospectId);
  if (fresh.length) await queueAutomations(db, "lead_created", fresh.map((contactId) => ({ contactId })));
  return out;
}

// The contact columns a prospect fills.
function fields(p: Row, provider: Provider | null): Record<string, unknown> {
  const person = Boolean(p.contact_first_name || p.contact_last_name);
  const business = p.business_name ?? null;
  return {
    kind: business ? (person ? "both" : "business") : "person",
    first_name: (p.contact_first_name || business || p.phone_e164).slice(0, 100), last_name: person ? p.contact_last_name ?? null : null,
    company_name: business, title: p.contact_title ?? null, email: p.email ?? null, phone: p.phone_e164, phone_ext: p.phone_ext ?? null,
    website: p.website, address: p.address, address2: p.address2 ?? null, city: p.city, state: p.state, zip: p.zip ?? null, country: p.country ?? null,
    locations: p.locations ?? null, source: "Prospecting (carrier lookup)",
    interest: provider ? `Switch from ${PROVIDERS[provider].label}` : null,
  };
}
