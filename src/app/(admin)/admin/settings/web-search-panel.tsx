"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, CircleDashed, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { saveWebSearchSettings, testWebSearch, webSearchStatus } from "@/lib/admin/actions/web-search";
import { cn } from "@/lib/utils";

type Provider = "perplexity" | "google" | "tavily";
const LABEL: Record<Provider, string> = { perplexity: "Perplexity (OpenRouter)", google: "Google Programmable Search", tavily: "Tavily" };
const PROVIDERS = Object.keys(LABEL) as Provider[];
type Status = Awaited<ReturnType<typeof webSearchStatus>>;
type Result = NonNullable<Awaited<ReturnType<typeof testWebSearch>>["result"]>;
const money = (c: number) => `$${(c / 100).toFixed(c < 100 ? 3 : 2).replace(/0$/, "")}`;

// Under the Web search keys: which providers work, the default one, prices
// and the monthly cap, and a test search.
export function WebSearchPanel({ readOnly }: { readOnly: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState<{ def: Provider; cap: string; prices: Record<Provider, string> } | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [query, setQuery] = useState("HVAC companies in Chandler, AZ");
  const [provider, setProvider] = useState<Provider>("perplexity");
  const [result, setResult] = useState<Result | null>(null);
  const [testError, setTestError] = useState<string>();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();

  useEffect(() => {
    void webSearchStatus().then((s) => {
      setStatus(s);
      setProvider(s.settings.defaultProvider);
      setForm({ def: s.settings.defaultProvider, cap: String(s.settings.monthlyCapCents / 100), prices: { perplexity: String(s.settings.prices.perplexity / 100), google: String(s.settings.prices.google / 100), tavily: String(s.settings.prices.tavily / 100) } });
    }).catch(() => setMsg({ error: "Couldn't load the web search settings." }));
  }, []);

  if (!status || !form) return <div className="h-40 animate-pulse rounded-xl border bg-muted/30" />;
  const n = (s: string) => Number(s.replace(/[$,\s]/g, ""));
  const save = () => start(async () => {
    const next = { defaultProvider: form.def, monthlyCapCents: Math.round(n(form.cap) * 100), prices: { perplexity: n(form.prices.perplexity) * 100, google: n(form.prices.google) * 100, tavily: n(form.prices.tavily) * 100 } };
    if ([next.monthlyCapCents, ...Object.values(next.prices)].some((x) => !Number.isFinite(x) || x < 0)) { setMsg({ error: "Use numbers only." }); return; }
    const r = await saveWebSearchSettings(next);
    setMsg(r);
    if (r.ok) setStatus({ ...status, settings: next });
  });

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <h3 className="font-semibold">Search settings and test</h3>
        <p className="text-sm text-muted-foreground">
          Agents use the default unless they ask for another. Every search is logged with its cost and stops at the monthly cap.
          {status.spentCents === null ? " Run supabase/migrations/20261124100000_web_search.sql to start logging." : ` This month: ${money(status.spentCents)} of ${money(status.settings.monthlyCapCents)}.`}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2 text-xs">
        {PROVIDERS.map((p) => (
          <li key={p} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", status.ready[p] ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
            {status.ready[p] ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />} {LABEL[p]}{status.ready[p] ? "" : ": add its key above"}
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="ws-def">Default</Label>
          <Pick id="ws-def" label="Default search" value={form.def} disabled={readOnly} onChange={(v) => setForm({ ...form, def: v as Provider })} options={PROVIDERS.map((p) => ({ value: p, label: LABEL[p] }))} /></div>
        <div className="space-y-1.5"><Label htmlFor="ws-cap">Monthly cap ($)</Label><Input id="ws-cap" inputMode="decimal" disabled={readOnly} value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
        {PROVIDERS.map((p) => (
          <div key={p} className="space-y-1.5"><Label htmlFor={`ws-${p}`}>{p === "perplexity" ? "Perplexity" : p === "google" ? "Google" : "Tavily"} per search ($)</Label>
            <Input id={`ws-${p}`} inputMode="decimal" disabled={readOnly} value={form.prices[p]} onChange={(e) => setForm({ ...form, prices: { ...form.prices, [p]: e.target.value } })} /></div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</Button>
          <span className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</span>
        </div>
      )}

      <form className="space-y-2 border-t pt-4" onSubmit={(e) => { e.preventDefault(); setTestError(undefined); setResult(null); startTest(async () => { const r = await testWebSearch(query, provider); if (r.error) setTestError(r.error); else setResult(r.result!); }); }}>
        <Label htmlFor="ws-q">Test a search</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="ws-q" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:flex-1" />
          <Pick label="Provider" value={provider} onChange={(v) => setProvider(v as Provider)} className="sm:w-56" options={PROVIDERS.map((p) => ({ value: p, label: LABEL[p] }))} />
          <Button type="submit" disabled={testing || query.trim().length < 2}><Search /> {testing ? "Searching…" : "Search"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">A test counts as one search (about {money(status.settings.prices[provider])}).</p>
        {testError && <p className="text-sm text-destructive">{testError}</p>}
        {result && (
          <div className="space-y-2 text-sm">
            {result.answer && <p className="rounded-lg bg-muted/50 p-3 whitespace-pre-wrap">{result.answer.slice(0, 1500)}</p>}
            <ol className="space-y-1.5">
              {result.results.map((r) => (
                <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{r.title}</a>
                  <span className="block truncate text-xs text-muted-foreground">{r.url}</span>{r.snippet && <span className="block text-xs">{r.snippet}</span>}</li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">{LABEL[result.provider as Provider]} · {result.results.length} results · {money(result.costCents)}</p>
          </div>
        )}
      </form>
    </section>
  );
}
