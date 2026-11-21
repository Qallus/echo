import type { SupabaseClient } from "@supabase/supabase-js";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";
import { ReportGrid } from "@/components/admin/analytics/report-grid";
import { LocalDate } from "@/components/local-date";
import { ASSISTANTS, loadVisibility } from "@/lib/analytics/ai-visibility";
import type { Analytics } from "@/lib/analytics/report";
import { VisibilityControls } from "./controls";

type Check = { model: string; question: string; mentioned: boolean; rank: number | null; competitors: string[]; cited_urls: string[]; error: string | null };

// AI assistants: the visitors they send, the bots that read the site, and
// whether they recommend Redial when asked.
export async function AiTab({ supabase, a, canRun }: { supabase: SupabaseClient; a: Analytics; canRun: boolean }) {
  const settings = await loadVisibility(supabase);
  const { data: runs } = await supabase.from("ai_visibility_runs").select("id, created_at, status, finished_at").order("created_at", { ascending: false }).limit(2);
  const latestDone = (runs ?? []).find((r) => r.status === "done");
  const running = (runs ?? []).find((r) => r.status === "running")?.id ?? null;
  const shown = latestDone ?? (runs ?? [])[0];
  const { data: checks } = shown
    ? await supabase.from("ai_visibility_checks").select("model, question, mentioned, rank, competitors, cited_urls, error").eq("run_id", shown.id)
    : { data: [] as Check[] };
  const list = ((checks ?? []) as Check[]).filter((c) => !c.error);
  const label = (id: string) => ASSISTANTS.find((x) => x.id === id)?.label ?? id;

  const byModel = [...new Set(list.map((c) => c.model))].map((m) => {
    const mine = list.filter((c) => c.model === m);
    const ranks = mine.filter((c) => c.rank).map((c) => c.rank!);
    return { assistant: label(m), asked: mine.length, named: mine.filter((c) => c.mentioned).length, share: mine.length ? mine.filter((c) => c.mentioned).length / mine.length : 0, rank: ranks.length ? ranks.reduce((x, y) => x + y, 0) / ranks.length : null };
  });
  const byQuestion = settings.questions.map((q) => {
    const mine = list.filter((c) => c.question === q);
    return { question: q, named: mine.filter((c) => c.mentioned).map((c) => label(c.model)).join(", ") || "No one yet", share: mine.length ? mine.filter((c) => c.mentioned).length / mine.length : 0 };
  });
  const rivals = new Map<string, number>();
  for (const c of list) for (const r of c.competitors) rivals.set(r, (rivals.get(r) ?? 0) + 1);
  const urls = new Map<string, number>();
  for (const c of list) for (const u of c.cited_urls) { try { const h = new URL(u).hostname.replace(/^www\./, ""); urls.set(h, (urls.get(h) ?? 0) + 1); } catch {} }
  const share = list.length ? list.filter((c) => c.mentioned).length / list.length : 0;
  const aiVisits = a.ai_sources.reduce((n, s) => n + s.sessions, 0);

  return (
    <div className="space-y-8">
      <StatRow>
        <StatTile label="Visits from AI assistants" value={aiVisits.toLocaleString()} hint={`${a.ai_sources.reduce((n, s) => n + s.converted, 0)} converted`} />
        <StatTile label="AI answers that name Redial" value={list.length ? `${Math.round(share * 100)}%` : "—"} hint={shown ? `${list.length} answers checked` : "Not checked yet"} accent />
        <StatTile label="AI crawler visits" value={a.crawlers.filter((c) => !/Googlebot|Bingbot/.test(c.bot)).reduce((n, c) => n + c.hits, 0).toLocaleString()} />
        <StatTile label="Search engine crawler visits" value={a.crawlers.filter((c) => /Googlebot|Bingbot/.test(c.bot)).reduce((n, c) => n + c.hits, 0).toLocaleString()} />
      </StatRow>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h3 className="text-sm font-semibold">Do AI assistants recommend Redial?</h3>
            <p className="text-xs text-muted-foreground">
              {shown ? <>Checked <LocalDate iso={shown.created_at} short />{shown.status === "running" ? " (still running)" : ""}. Runs automatically every month.</> : "Runs automatically once a month, or now."}
            </p>
          </div>
          {canRun && <VisibilityControls questions={settings.questions} competitors={settings.competitors} running={running} />}
        </div>
        <div className="grid gap-8 xl:grid-cols-2">
          <ReportGrid id="ai-assistants" title="By assistant" columns={[
            { key: "assistant", label: "Assistant" }, { key: "share", label: "Names Redial", format: "percent", bar: true },
            { key: "named", label: "Answers naming Redial", format: "count" }, { key: "asked", label: "Questions", format: "count" }, { key: "rank", label: "Avg. place among brands", format: "number" },
          ]} rows={byModel} empty="No answers yet. Run the check." />
          <ReportGrid id="ai-rivals" title="Competitors they name" columns={[{ key: "brand", label: "Brand" }, { key: "answers", label: "Answers", format: "count", bar: true }]}
            rows={[...rivals].sort((x, y) => y[1] - x[1]).map(([brand, answers]) => ({ brand, answers }))} empty="No competitors named yet." />
        </div>
        <ReportGrid id="ai-questions" title="By question" columns={[{ key: "question", label: "Question" }, { key: "named", label: "Named Redial" }, { key: "share", label: "Share", format: "percent", bar: true }]} rows={byQuestion} />
        <ReportGrid id="ai-cited" title="Sites AI assistants cite" note="Getting mentioned on these sites helps AI recommend Redial." columns={[{ key: "site", label: "Site" }, { key: "times", label: "Times cited", format: "count", bar: true }]}
          rows={[...urls].sort((x, y) => y[1] - x[1]).slice(0, 20).map(([site, times]) => ({ site, times }))} empty="No links cited yet (Perplexity cites the most)." />
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <ReportGrid id="ai-sources" title="Visits from AI assistants" columns={[{ key: "source", label: "Assistant" }, { key: "sessions", label: "Visits", format: "count", bar: true }, { key: "converted", label: "Converted", format: "count" }]}
          rows={a.ai_sources} empty="No visits from AI assistants in this period." />
        <ReportGrid id="ai-crawlers" title="Crawlers reading the site" columns={[{ key: "bot", label: "Bot" }, { key: "hits", label: "Visits", format: "count", bar: true }, { key: "pages", label: "Pages", format: "count" }]}
          rows={a.crawlers} empty="No crawler visits logged in this period." />
      </div>
      <ReportGrid id="ai-crawled" title="Pages crawlers read most" columns={[{ key: "path", label: "Page" }, { key: "hits", label: "Visits", format: "count", bar: true }, { key: "bots", label: "By" }]}
        rows={a.crawled_pages.map((p) => ({ ...p, bots: p.bots.join(", ") }))} />
    </div>
  );
}
