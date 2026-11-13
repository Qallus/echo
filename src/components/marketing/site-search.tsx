"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Bot, Building2, CircleHelp, Globe, Headset, House, Loader2, Mic, Search, Smartphone, Sparkles, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEARCH_CATEGORIES, searchSite, suggestionsFor, type SearchCategory, type SearchEntry } from "@/lib/site-search";
import { cn } from "@/lib/utils";

const ICONS: Record<SearchCategory, LucideIcon> = {
  all: Globe, residential: House, business: Building2, "live-agents": Headset, "ai-agents": Bot, apps: Smartphone,
};
const LABEL = Object.fromEntries(SEARCH_CATEGORIES.map((c) => [c.id, c.label])) as Record<SearchCategory, string>;
const POPULAR = ["/home-phone", "/redial/business", "/live-agents", "/#redial", "/#app", "/business-phone", "/become-a-live-agent", "/pricing"];

type Link_ = { title: string; href: string; desc: string };
type Answer = { q: string; loading: boolean; answer?: string | null; links?: Link_[]; error?: string };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

const noop = () => () => {};
const speechCtor = () => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

// Header search (the icon left of the cart). Opens a panel under the header:
// pick an area, then type, speak, or ask the AI. Results appear as you type;
// Enter opens the highlighted one, or asks the AI when nothing matches.
export function SiteSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<SearchCategory>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [ai, setAi] = useState<Answer | null>(null);
  const [listening, setListening] = useState(false);
  const voice = useSyncExternalStore(noop, () => speechCtor() !== null, () => false);
  const input = useRef<HTMLInputElement>(null);
  const rec = useRef<Recognition | null>(null);

  const results = useMemo(() => searchSite(q, cat, 8), [q, cat]);
  const suggestions = useMemo(() => (cat === "all" ? POPULAR.map((h) => suggestionsFor("all").find((e) => e.href === h)!).filter(Boolean) : suggestionsFor(cat)), [cat]);
  const agentSearch = q.trim() && (cat === "all" || cat === "live-agents");
  // Rows the arrow keys move through: Ask AI, then results, then Live Agent search.
  const rows = useMemo(() => [
    { kind: "ai" as const },
    ...results.map((e) => ({ kind: "result" as const, e })),
    ...(agentSearch ? [{ kind: "agents" as const }] : []),
  ], [results, agentSearch]);

  // Open with "/" or Ctrl/Cmd+K; close with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) input.current?.focus(); else rec.current?.stop(); }, [open]);

  const close = () => setOpen(false);
  const go = (href: string) => { close(); router.push(href); };

  const ask = async (text = q) => {
    const question = text.trim();
    if (question.length < 2) { input.current?.focus(); return; }
    setAi({ q: question, loading: true });
    try {
      const r = await fetch("/api/site-ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: question, category: cat }) });
      const data = (await r.json()) as { answer?: string | null; links?: Link_[]; error?: string };
      setAi({ q: question, loading: false, answer: data.answer ?? null, links: data.links ?? [], error: data.error });
    } catch {
      setAi({ q: question, loading: false, links: searchSite(question, cat, 3), error: "Couldn't reach the AI. Here's what matches." });
    }
  };

  const listen = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    let said = "";
    r.onresult = (e) => { said = Array.from(e.results).map((x) => x[0].transcript).join(" "); setQ(said); setActive(0); setAi(null); };
    r.onend = () => { setListening(false); if (said.trim().split(/\s+/).length >= 4) void ask(said); };
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const row = q.trim() ? rows[active] : undefined;
      if (!row || row.kind === "ai") void ask();
      else if (row.kind === "result") go(row.e.href);
      else go(`/live-agents?q=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <X className="size-5" /> : <Search className="size-5" />}
      </Button>
      {open && (
        <>
          {/* The dimmed page behind the panel (in body: the header's blur would trap a fixed element). */}
          {createPortal(<button type="button" aria-label="Close search" tabIndex={-1} onClick={close}
            className="fixed inset-0 z-20 cursor-default bg-black/30 backdrop-blur-[2px]" />, document.body)}
          <div role="search" className="absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] overflow-y-auto border-b bg-background shadow-xl">
            <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6">
              <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0" role="tablist" aria-label="Search in">
                {SEARCH_CATEGORIES.map((c) => {
                  const Icon = ICONS[c.id];
                  return (
                    <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => { setCat(c.id); setActive(0); setAi(null); input.current?.focus(); }}
                      className={cn("flex shrink-0 flex-col items-center gap-1.5 border-b-2 px-3 pt-1 pb-2 text-xs transition-colors sm:text-sm",
                        cat === c.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                      <Icon className="size-5" />{c.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 rounded-full border bg-background p-1.5 pl-5 shadow-md ring-foreground/10 focus-within:ring-2">
                <Search className="size-5 shrink-0 text-muted-foreground" />
                <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); setAi(null); }} onKeyDown={onKeyDown}
                  placeholder={listening ? "Listening…" : cat === "live-agents" ? "Search Live Agents, rates, how it works…" : `Search ${cat === "all" ? "Redial" : LABEL[cat]}, or ask a question`}
                  aria-label="Search the site" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground" />
                {q && <Button variant="ghost" size="icon-sm" aria-label="Clear" onClick={() => { setQ(""); setAi(null); input.current?.focus(); }}><X /></Button>}
                {voice && (
                  <Button variant="ghost" size="icon" aria-label={listening ? "Stop listening" : "Search by voice"} aria-pressed={listening} onClick={listen}
                    className={cn("rounded-full", listening && "bg-red-500/15 text-red-600 dark:text-red-400")}>
                    <Mic className={cn("size-5", listening && "animate-pulse")} />
                  </Button>
                )}
                <Button className="h-11 rounded-full px-4" onClick={() => void ask()} aria-label="Ask AI">
                  <Sparkles /><span className="hidden sm:inline">Ask AI</span>
                </Button>
              </div>

              {ai && (
                <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                  <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"><Sparkles className="size-3.5" /> Redial AI · {ai.q}</p>
                  {ai.loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Finding the answer…</p> : (
                    <>
                      {ai.answer && <p className="text-sm leading-relaxed">{ai.answer}</p>}
                      {ai.error && <p className="text-sm text-muted-foreground">{ai.error}</p>}
                      {!!ai.links?.length && (
                        <div className="flex flex-wrap gap-2">
                          {ai.links.map((l) => (
                            <Link key={l.href} href={l.href} onClick={close} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted">
                              {l.title}<ArrowRight className="size-3.5" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {q.trim() ? (
                <ul className="space-y-0.5" role="listbox" aria-label="Results">
                  {rows.map((row, i) => {
                    const on = i === active;
                    const cls = cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", on ? "bg-muted" : "hover:bg-muted/60");
                    if (row.kind === "ai") return (
                      <li key="ai" role="option" aria-selected={on}>
                        <button type="button" className={cls} onMouseEnter={() => setActive(i)} onClick={() => void ask()}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"><Sparkles className="size-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">Ask Redial AI: “{q.trim()}”</span><span className="block text-xs text-muted-foreground">A quick answer with the pages that help</span></span>
                        </button>
                      </li>
                    );
                    if (row.kind === "agents") return (
                      <li key="agents" role="option" aria-selected={on}>
                        <Link href={`/live-agents?q=${encodeURIComponent(q.trim())}`} onClick={close} className={cls} onMouseEnter={() => setActive(i)}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border"><Headset className="size-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">Search Live Agents for “{q.trim()}”</span><span className="block text-xs text-muted-foreground">By name, skill, language or industry</span></span>
                        </Link>
                      </li>
                    );
                    return <ResultRow key={row.e.href + row.e.title} e={row.e} cls={cls} on={on} onHover={() => setActive(i)} onPick={close} />;
                  })}
                  {!results.length && <li className="px-3 py-2 text-sm text-muted-foreground">No pages match yet. Press Enter to ask the AI.</li>}
                </ul>
              ) : !ai && (
                <div className="space-y-2">
                  <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{cat === "all" ? "Popular" : LABEL[cat]}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {suggestions.map((e) => {
                      const Icon = ICONS[e.cat];
                      return (
                        <Link key={e.href + e.title} href={e.href} onClick={close} className="flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span>
                          <span className="min-w-0"><span className="block text-sm font-medium">{e.title}</span><span className="block text-xs text-muted-foreground">{e.desc}</span></span>
                        </Link>
                      );
                    })}
                  </div>
                  <p className="hidden px-1 pt-1 text-xs text-muted-foreground sm:block">Tip: press <kbd className="rounded border px-1">/</kbd> anywhere to search{voice ? ", or tap the mic and just ask" : ""}.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ResultRow({ e, cls, on, onHover, onPick }: { e: SearchEntry; cls: string; on: boolean; onHover: () => void; onPick: () => void }) {
  const Icon = e.faq ? CircleHelp : ICONS[e.cat];
  return (
    <li role="option" aria-selected={on}>
      <Link href={e.href} onClick={onPick} className={cls} onMouseEnter={onHover}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border"><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{e.desc}</span>
        </span>
        <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{e.faq ? "Question" : LABEL[e.cat]}</span>
      </Link>
    </li>
  );
}
