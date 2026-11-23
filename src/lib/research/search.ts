import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { secret, secrets } from "@/lib/secrets";

// Web search for agents and staff, three ways:
//   perplexity: OpenRouter's perplexity/sonar. A written answer with its
//               sources (OPENROUTER_API_KEY, already used for AI).
//   google:     Google Programmable Search, raw results
//               (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID).
//   tavily:     Tavily, results built for AI agents plus a short answer
//               (TAVILY_API_KEY).
// Every search is logged in web_searches with its cost, and refused once
// this month's total would pass the cap (settings 'web_search').

export const SEARCH_PROVIDERS = [
  { id: "perplexity", label: "Perplexity (via OpenRouter)", keys: ["OPENROUTER_API_KEY"] },
  { id: "google", label: "Google Programmable Search", keys: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"] },
  { id: "tavily", label: "Tavily", keys: ["TAVILY_API_KEY"] },
] as const;
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]["id"];
export const isSearchProvider = (v: unknown): v is SearchProvider => SEARCH_PROVIDERS.some((p) => p.id === v);

export type SearchResult = { title: string; url: string; snippet: string };
export type SearchOutcome = { provider: SearchProvider; answer: string | null; results: SearchResult[]; costCents: number };

export type WebSearchSettings = {
  defaultProvider: SearchProvider;
  monthlyCapCents: number;
  prices: Record<SearchProvider, number>; // cents per search
};
export const DEFAULT_WEB_SEARCH: WebSearchSettings = {
  defaultProvider: "perplexity", monthlyCapCents: 1000,
  // Roughly: Perplexity sonar ~$0.006 a search, Google $5 per 1,000 after 100 free a day, Tavily ~1 credit (~$0.008).
  prices: { perplexity: 1, google: 0.5, tavily: 0.8 },
};

const num = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : d);
export function readWebSearch(value: unknown): WebSearchSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<WebSearchSettings>;
  const d = DEFAULT_WEB_SEARCH;
  const p = (v.prices ?? {}) as Partial<Record<SearchProvider, unknown>>;
  return {
    defaultProvider: isSearchProvider(v.defaultProvider) ? v.defaultProvider : d.defaultProvider,
    monthlyCapCents: num(v.monthlyCapCents, 0, 1_000_000, d.monthlyCapCents),
    prices: { perplexity: num(p.perplexity, 0, 100, d.prices.perplexity), google: num(p.google, 0, 100, d.prices.google), tavily: num(p.tavily, 0, 100, d.prices.tavily) },
  };
}
export async function loadWebSearch(db: SupabaseClient) {
  const { data } = await db.from("platform_settings").select("value").eq("key", "web_search").maybeSingle();
  return readWebSearch(data?.value);
}

// Which providers have their keys.
export async function searchReady(): Promise<Record<SearchProvider, boolean>> {
  const k = await secrets("OPENROUTER_API_KEY", "GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID", "TAVILY_API_KEY");
  return { perplexity: Boolean(k.OPENROUTER_API_KEY), google: Boolean(k.GOOGLE_SEARCH_API_KEY && k.GOOGLE_SEARCH_ENGINE_ID), tavily: Boolean(k.TAVILY_API_KEY) };
}

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
export async function searchMonthSpent(db: SupabaseClient) {
  const { data } = await db.from("web_searches").select("cost_cents").gte("created_at", monthStart()).limit(20000);
  return (data ?? []).reduce((n, r) => n + Number(r.cost_cents), 0);
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

async function perplexity(query: string, count: number, system?: string): Promise<Omit<SearchOutcome, "provider" | "costCents">> {
  const key = await secret("OPENROUTER_API_KEY");
  if (!key) throw new Error("Perplexity needs the OpenRouter key (Integrations → AI providers → OpenRouter).");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://redial.si", "X-Title": "Redial" },
    body: JSON.stringify({
      model: "perplexity/sonar", max_tokens: 1200,
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: query }],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string; annotations?: { type?: string; url_citation?: { url?: string; title?: string; content?: string } }[] } }[];
    citations?: string[]; error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Perplexity: ${body.error?.message ?? `HTTP ${res.status}`}`);
  const msg = body.choices?.[0]?.message;
  const fromAnnotations = (msg?.annotations ?? []).filter((a) => a.url_citation?.url).map((a) => ({ title: clip(a.url_citation!.title, 200) || a.url_citation!.url!, url: a.url_citation!.url!, snippet: clip(a.url_citation!.content, 300) }));
  const fromCitations = (body.citations ?? []).map((u) => ({ title: u, url: u, snippet: "" }));
  const seen = new Set<string>();
  const results = [...fromAnnotations, ...fromCitations].filter((r) => !seen.has(r.url) && seen.add(r.url)).slice(0, count);
  return { answer: msg?.content?.trim() || null, results };
}

async function google(query: string, count: number) {
  const k = await secrets("GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID");
  if (!k.GOOGLE_SEARCH_API_KEY || !k.GOOGLE_SEARCH_ENGINE_ID) throw new Error("Google Programmable Search needs its API key and search engine ID (Integrations → Web search).");
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.searchParams.set("key", k.GOOGLE_SEARCH_API_KEY); u.searchParams.set("cx", k.GOOGLE_SEARCH_ENGINE_ID);
  u.searchParams.set("q", query); u.searchParams.set("num", String(Math.min(count, 10))); u.searchParams.set("gl", "us");
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000) });
  const body = (await res.json().catch(() => ({}))) as { items?: { title?: string; link?: string; snippet?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Google: ${body.error?.message ?? `HTTP ${res.status}`}`);
  return { answer: null, results: (body.items ?? []).filter((i) => i.link).map((i) => ({ title: clip(i.title, 200), url: i.link!, snippet: clip(i.snippet, 300) })) };
}

async function tavily(query: string, count: number) {
  const key = await secret("TAVILY_API_KEY");
  if (!key) throw new Error("Tavily needs its API key (Integrations → Web search).");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: Math.min(count, 20), include_answer: true, search_depth: "basic" }),
  });
  const body = (await res.json().catch(() => ({}))) as { answer?: string; results?: { title?: string; url?: string; content?: string }[]; detail?: { error?: string } | string };
  if (!res.ok) throw new Error(`Tavily: ${typeof body.detail === "string" ? body.detail : body.detail?.error ?? `HTTP ${res.status}`}`);
  return { answer: body.answer?.trim() || null, results: (body.results ?? []).filter((r) => r.url).map((r) => ({ title: clip(r.title, 200), url: r.url!, snippet: clip(r.content, 300) })) };
}

// One search, checked against the monthly cap and logged. Throws with a
// plain message the caller can show.
export async function webSearch(db: SupabaseClient, input: { query: string; provider?: SearchProvider; count?: number; kind?: "search" | "leads"; system?: string }): Promise<SearchOutcome> {
  const query = clip(input.query, 400);
  if (query.length < 2) throw new Error("Type something to search for.");
  const settings = await loadWebSearch(db);
  const ready = await searchReady();
  let provider = input.provider ?? settings.defaultProvider;
  if (!ready[provider] && !input.provider) provider = (SEARCH_PROVIDERS.find((p) => ready[p.id])?.id ?? provider) as SearchProvider;
  if (!ready[provider]) throw new Error(`${SEARCH_PROVIDERS.find((p) => p.id === provider)!.label} isn't set up. Add its key in Admin → Settings → Integrations → Web search.`);
  const cost = settings.prices[provider];
  const spent = await searchMonthSpent(db);
  if (spent + cost > settings.monthlyCapCents) throw new Error(`This month's web search cap ($${(settings.monthlyCapCents / 100).toFixed(2)}) is reached. Raise it in Integrations → Web search.`);
  const count = Math.min(Math.max(input.count ?? 8, 1), 20);
  const out = provider === "perplexity" ? await perplexity(query, count, input.system) : provider === "google" ? await google(query, count) : await tavily(query, count);
  await db.from("web_searches").insert({ provider, query, kind: input.kind ?? "search", results: out.results.length, cost_cents: cost });
  return { provider, ...out, costCents: cost };
}

// Businesses to call on, from a search: name, website, phone, city and why.
export type LeadCandidate = { name: string; website: string | null; phone: string | null; city: string | null; state: string | null; category: string | null; why: string | null };
const LEADS_SYSTEM = "You find small and local businesses for a sales team. Answer ONLY with a JSON array (no prose, no code fences) of objects with keys name, website, phone, city, state, category, why (one short reason they'd want an AI receptionist or call screening). Use real businesses you found, with their main business phone number if published. Up to 15.";

export async function researchLeads(db: SupabaseClient, input: { what: string; where: string; provider?: SearchProvider }): Promise<{ candidates: LeadCandidate[]; sources: SearchResult[]; provider: SearchProvider; costCents: number; raw?: string }> {
  const query = `${input.what.trim()} in ${input.where.trim()}: list businesses with their website and main phone number`;
  const usePerplexity = (input.provider ?? "perplexity") === "perplexity" && (await searchReady()).perplexity;
  const r = await webSearch(db, { query, provider: usePerplexity ? "perplexity" : input.provider, kind: "leads", count: 15, system: usePerplexity ? LEADS_SYSTEM : undefined });
  if (r.provider === "perplexity" && r.answer) {
    const json = r.answer.slice(r.answer.indexOf("["), r.answer.lastIndexOf("]") + 1);
    try {
      const list = JSON.parse(json) as Record<string, unknown>[];
      const candidates = list.filter((x) => typeof x?.name === "string").slice(0, 15).map((x) => ({
        name: clip(x.name, 200), website: clip(x.website, 300) || null, phone: clip(x.phone, 40) || null, city: clip(x.city, 100) || null,
        state: clip(x.state, 60) || null, category: clip(x.category, 100) || clip(input.what, 100) || null, why: clip(x.why, 300) || null,
      }));
      return { candidates, sources: r.results, provider: r.provider, costCents: r.costCents };
    } catch { /* fall through: return the raw answer */ }
  }
  // Raw results: the agent reads them and picks businesses itself.
  return { candidates: [], sources: r.results, provider: r.provider, costCents: r.costCents, raw: r.answer ?? undefined };
}
