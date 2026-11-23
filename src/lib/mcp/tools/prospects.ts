import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { adminAudit } from "@/lib/admin/audit";
import { PROVIDERS } from "@/lib/prospects/carriers";
import { listProspects } from "@/lib/prospects/data";
import { findPlacesFor, insertPlaces, insertProspects } from "@/lib/prospects/ops";
import { prospectsToLeads } from "@/lib/prospects/to-leads";
import { estimate, processChunk, startRun } from "@/lib/prospects/runner";
import { PROSPECT_STATUSES, type Prospect } from "@/lib/prospects/types";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { id } from "./shared";

// Admin -> Prospects through the connector (staff): list and add prospects,
// find businesses on Google Maps, look up who carries each number (Twilio,
// costs money: preview and confirm), and turn the best into CRM leads.
// crm.view to read, crm.manage to add or convert, prospects.run to spend.

const RULES = "Business numbers only. Outreach is by a person calling (mobile numbers checked against the National Do Not Call Registry) or by email: no cold texts and no automated or AI-voice calls to prospects.";
const providerIds = Object.keys(PROVIDERS) as [keyof typeof PROVIDERS, ...(keyof typeof PROVIDERS)[]];

const brief = (p: Prospect) => ({
  id: p.id, business: p.business_name, phone: p.phone_e164, category: p.category, city: p.city, state: p.state, website: p.website,
  provider: p.provider ? PROVIDERS[p.provider].label : null, confidence: p.confidence, confirmed_by_staff: p.providerByYou,
  carrier: p.lookup?.carrier_name ?? null, line_type: p.lookup?.line_type ?? null, score: p.score, status: p.status,
  rating: p.rating ?? null, reviews: p.review_count ?? null, in_crm: Boolean(p.crm_contact_id), source: p.source, added: p.created_at,
});

const place = z.object({
  placeId: z.string().max(300), name: z.string().max(200), phone: z.string().max(40).nullable(), phoneE164: z.string().max(20).nullable(),
  website: z.string().max(300).nullable(), address: z.string().max(300).nullable(), address2: z.string().max(100).nullable(),
  city: z.string().max(100).nullable(), state: z.string().max(60).nullable(), zip: z.string().max(20).nullable(), country: z.string().max(60).nullable(),
  category: z.string().max(100).nullable(), rating: z.number().min(0).max(5).nullable(), reviews: z.number().int().min(0).nullable(),
  lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(), open: z.boolean(),
});

const prospectRow = z.object({
  phone: z.string().min(7).max(40), business_name: z.string().max(200).optional(), website: z.string().max(300).optional(),
  address: z.string().max(300).optional(), address2: z.string().max(100).optional(), city: z.string().max(100).optional(), state: z.string().max(60).optional(),
  zip: z.string().max(20).optional(), category: z.string().max(100).optional(), contact_first_name: z.string().max(100).optional(),
  contact_last_name: z.string().max(100).optional(), email: z.string().max(200).optional(), tags: z.string().max(400).optional().describe("Comma separated"),
  notes: z.string().max(5000).optional(),
});

// Runs a confirmed lookup: starts it and works through it for up to ~40
// seconds; the scheduled job finishes anything left.
confirmable("prospects_lookup", async (ctx, p) => {
  const ids = Array.isArray(p.prospect_ids) ? (p.prospect_ids as string[]) : null;
  const callerName = Boolean(p.caller_name);
  const r = await startRun(ctx.supabase, ids, callerName);
  if (r.error || !r.runId) throw new ToolError(r.error ?? "Couldn't start the lookup.");
  await adminAudit(ctx.supabase, "prospects.lookup.start", { type: "lookup_run", id: r.runId }, { numbers: r.est?.toLookUp, cached: r.est?.cached, est_cost_cents: r.est?.estCents, caller_name: callerName, via: "mcp" });
  const until = Date.now() + 40_000;
  let progress = await processChunk(ctx.supabase, r.runId);
  while (!progress.done && Date.now() < until) progress = await processChunk(ctx.supabase, r.runId);
  if (progress.done && progress.handled) await adminAudit(ctx.supabase, "prospects.lookup.done", { type: "lookup_run", id: r.runId }, { processed: progress.processed, failed: progress.failed, cost_cents: progress.costCents, via: "mcp" });
  return { targetId: r.runId, data: {
    run_id: r.runId, done: progress.done, looked_up: progress.processed, failed: progress.failed, total: progress.total, cost_cents: progress.costCents, reused_from_cache: r.est?.cached ?? 0,
    message: progress.done ? "Finished. Call prospects_list to see providers and scores." : "Still running; the scheduled job finishes it within a few minutes. Call prospects_list later.",
  } };
});

export function registerProspectTools(server: McpServer, ctx: McpContext, perms: string[]) {
  if (!perms.includes("crm.view")) return;
  const base = { prefix: "", domain: "prospects" };
  const need = (perm: string) => { if (!perms.includes(perm)) throw new ToolError(`That needs the ${perm} permission.`); };

  defineTool(server, ctx, "prospects_list", {
    ...base, risk: "read", title: "List prospects",
    description: `Admin -> Prospects: businesses to call on, with who carries each number (RingCentral, Cox, Spectrum, other VoIP, landline, mobile), a fit score (0-100), status and Google rating. Filter by provider, status, minimum score, looked up or not, and search text. ${RULES}`,
    inputSchema: z.object({
      provider: z.enum(providerIds).optional(), status: z.enum(PROSPECT_STATUSES.map((s) => s.id) as [string, ...string[]]).optional(),
      min_score: z.number().int().min(0).max(100).optional(), looked_up: z.boolean().optional(), search: z.string().trim().max(80).optional(),
      sort: z.enum(["score", "newest"]).default("score"), limit: z.number().int().min(1).max(200).default(50),
    }),
  }, async ({ provider, status, min_score, looked_up, search, sort, limit }) => {
    const words = (search ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (await listProspects(ctx.supabase))
      .filter((p) => (!provider || p.provider === provider) && (!status || p.status === status) && (min_score == null || (p.score ?? 0) >= min_score)
        && (looked_up == null || Boolean(p.lookup) === looked_up)
        && words.every((w) => [p.business_name, p.phone_e164, p.category, p.city, p.state, p.lookup?.carrier_name].some((x) => x?.toLowerCase().includes(w))))
      .sort((a, b) => (sort === "score" ? (b.score ?? 0) - (a.score ?? 0) : b.created_at.localeCompare(a.created_at)));
    return { data: { total: rows.length, prospects: rows.slice(0, limit).map(brief), rules: RULES } };
  });

  defineTool(server, ctx, "prospects_add", {
    ...base, risk: "write", title: "Add prospects",
    description: "Adds up to 500 businesses to Admin -> Prospects. Only the phone is required; numbers already on the list or not valid are skipped. Business numbers only.",
    inputSchema: z.object({ rows: z.array(prospectRow).min(1).max(500) }),
  }, async ({ rows }) => {
    need("crm.manage");
    const r = await insertProspects(ctx.supabase, rows, "manual");
    if (r.error) throw new ToolError(r.error);
    return { data: { added: r.added, already_on_list: r.duplicates, not_valid: r.invalid, message: r.ok } };
  });

  defineTool(server, ctx, "prospects_find_places", {
    ...base, risk: "write", title: "Find businesses on Google Maps",
    description: "Searches Google Maps (Places) for businesses, like \"HVAC in Chandler, AZ\": up to 20 a page and 3 pages, with phone, website, address, category, rating and whether each is already on the list. Each page is one billed Google request (price in Prospects -> Settings) and counts against the monthly prospecting cap. Nothing is added: pass the ones to keep to prospects_add_places.",
    inputSchema: z.object({ query: z.string().trim().min(3).max(200), page_token: z.string().max(2000).optional().describe("next_page_token from the previous page"), page: z.number().int().min(1).max(3).default(1) }),
  }, async ({ query, page_token, page }) => {
    need("prospects.run");
    const r = await findPlacesFor(ctx.supabase, query, page_token, page);
    if (r.error) throw new ToolError(r.error);
    return { data: { results: r.results, next_page_token: r.next ?? null, page, cost_cents: r.costCents, month_spent_cents: r.spentCents, month_cap_cents: r.capCents } };
  });

  defineTool(server, ctx, "prospects_add_places", {
    ...base, risk: "write", title: "Add businesses found on Google Maps",
    description: "Adds businesses from prospects_find_places (pass the result objects unchanged) to the prospect list, with their map position and Google rating. Ones without a phone, or already on the list, are skipped.",
    inputSchema: z.object({ places: z.array(place).min(1).max(200), tags: z.string().max(400).optional().describe("Comma separated, added to each") }),
  }, async ({ places, tags }) => {
    need("crm.manage");
    const r = await insertPlaces(ctx.supabase, places, tags);
    if (r.error) throw new ToolError(r.error);
    return { data: { added: r.added, message: r.ok } };
  });

  defineTool(server, ctx, "prospects_lookup", {
    ...base, risk: "high", previewOnly: true, title: "Look up carriers (costs money)",
    description: "Looks up who carries each number with Twilio (line type, carrier, optional caller name), which fills in the provider and score. Pass prospect_ids, or leave it out for every prospect not looked up yet. Numbers checked recently are reused free. Returns the cost estimate and a confirmation_id; run with confirm_action after a clear yes.",
    inputSchema: z.object({ prospect_ids: z.array(id("Prospect")).min(1).max(5000).optional(), caller_name: z.boolean().default(false) }),
  }, async ({ prospect_ids, caller_name }) => {
    need("prospects.run");
    const est = await estimate(ctx.supabase, prospect_ids ?? null, caller_name);
    if (!est.total) throw new ToolError("No numbers to look up.");
    if (est.overCap) throw new ToolError(`That would pass this month's cap ($${(est.capCents / 100).toFixed(2)}; $${(est.monthSpentCents / 100).toFixed(2)} spent). Pick fewer, or raise the cap in Prospects -> Settings.`);
    const cost = `$${(est.estCents / 100).toFixed(2)}`;
    return prepare(ctx, "prospects_lookup", { prospect_ids: prospect_ids ?? null, caller_name }, `Look up ${est.toLookUp} numbers for about ${cost}${est.cached ? ` (${est.cached} reused free)` : ""}`, {
      numbers: est.total, to_look_up: est.toLookUp, reused_free: est.cached, estimated_cost_cents: est.estCents,
      month_spent_cents: est.monthSpentCents, month_cap_cents: est.capCents, caller_name,
    });
  });

  defineTool(server, ctx, "prospects_to_leads", {
    ...base, risk: "write", title: "Turn prospects into CRM leads",
    description: "Converts prospects into CRM leads with everything carried over (contact person, address, website, provider, score, tags), tagged by provider. Numbers already in the CRM are linked, never duplicated. Do-not-contact prospects are refused. To open deals as well, follow with crm_lead_convert on the returned contact_ids.",
    inputSchema: z.object({ prospect_ids: z.array(id("Prospect")).min(1).max(200) }),
  }, async ({ prospect_ids }) => {
    need("crm.manage");
    const r = await prospectsToLeads(ctx.supabase, prospect_ids);
    if (r.error) throw new ToolError(r.error);
    await adminAudit(ctx.supabase, "prospects.to_leads", undefined, { created: r.created, linked: r.linked, skipped_dnc: r.skippedDnc, via: "mcp" });
    return { targetId: r.contactIds[0] ?? null, data: { created: r.created, linked: r.linked, skipped_do_not_contact: r.skippedDnc, contact_ids: r.contactIds } };
  });
}
