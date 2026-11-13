import { generateText, Output } from "ai";
import { z } from "zod";
import { resolveCandidates, type ModelChoice, type Resolved } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { requestIp } from "@/lib/mcp/agents";
import { SITE_FAQ, SITE_PAGES, SEARCH_CATEGORIES, searchSite } from "@/lib/site-search";
import { createClient } from "@/lib/supabase/server";

// "Ask AI" in the public site search. Answers only from the site's own pages
// and FAQ, and points to up to three of them. No account needed, so each
// visitor gets a small allowance (per server instance).

export const maxDuration = 30;

const hits = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.filter((t) => now - t < 60_000).length >= 6 || recent.length >= 40) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return true;
}

const pages = SITE_PAGES.map((p) => `- ${p.title} (${p.href}): ${p.desc}`).join("\n");
const faqs = SITE_FAQ.map((f) => `Q: ${f.title} (${f.href})\nA: ${f.answer}`).join("\n\n");
const SYSTEM = `You are the search assistant on the Redial website (Redial: AI call screening and phone service, Echo: call and meeting recordings with transcripts, Redial Live Agents: real people who answer business calls).
Answer the visitor's question in at most 3 short, plain sentences using ONLY the pages and FAQ below. If the answer isn't there, say so briefly and point to the closest page or to /contact. Never quote prices; point to /pricing or /live-agents/how-it-works#pricing instead.
Return up to 3 links, using hrefs exactly as written below, most useful first.

PAGES
${pages}

FAQ
${faqs}`;

const schema = z.object({ answer: z.string(), links: z.array(z.string()).max(3) });
const known = new Map([...SITE_PAGES, ...SITE_FAQ].map((e) => [e.href, e]));

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { q?: unknown; category?: unknown };
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 300) : "";
  if (q.length < 2) return Response.json({ error: "Type a question first." }, { status: 400 });
  if (!allowed(requestIp(req) || "unknown")) return Response.json({ error: "That's a lot of questions. Try again in a minute." }, { status: 429 });
  const cat = SEARCH_CATEGORIES.find((c) => c.id === body.category && c.id !== "all");

  const supabase = await createClient();
  const settings = await getAiSettings(supabase);
  const attempts: Resolved[] = [];
  for (const choice of (settings.summaryOrder as ModelChoice[]).filter((m, i, a) => !!m && a.indexOf(m) === i)) {
    attempts.push(...(await resolveCandidates(supabase, choice, { settings, keys: [] })));
    if (attempts.length >= 2) break;
  }
  const fallback = searchSite(q, cat?.id ?? "all", 3).map((e) => ({ title: e.title, href: e.href, desc: e.desc }));
  for (const picked of attempts) {
    try {
      const { output } = await generateText({
        model: picked.model, system: SYSTEM, output: Output.object({ schema }), maxOutputTokens: 400,
        prompt: `${cat ? `They're browsing: ${cat.label}.\n` : ""}Question: ${q}`,
      });
      const links = output.links.map((h) => known.get(h)).filter((e) => e !== undefined).map((e) => ({ title: e.title, href: e.href, desc: e.desc }));
      return Response.json({ answer: output.answer.trim().slice(0, 600), links: links.length ? links : fallback });
    } catch (e) {
      console.error("[site-ask]", picked.provider, e instanceof Error ? e.message : e);
    }
  }
  return Response.json({ answer: null, links: fallback, error: "The AI answer isn't available right now. Here's what matches." });
}
