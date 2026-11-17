"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft, AudioLines, AudioWaveform, Bell, Bot, BotMessageSquare, BookUser, Briefcase, Building2, CalendarDays, ChartColumn, Compass, Contact, Cpu,
  CreditCard, FileAudio, FileChartColumn, FolderOpen, Hash, Headphones, Headset, Home, IdCard, KeyRound, LayoutDashboard, LayoutTemplate, ListChecks,
  ListFilter, ListTodo, Magnet, Mail, MessagesSquare, Mic, Monitor, NotebookPen, Phone, PhoneCall, PhoneForwarded, PhoneIncoming, Plug, Receipt, ScanEye,
  Search, Settings, ShieldCheck, Smartphone, Sparkles, SquareKanban, Upload, UserRound, Users, UsersRound, Video, Wallet, WandSparkles, Workflow, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASH_CATEGORIES, searchDash, visibleEntries, type DashCategory, type DashEntry } from "@/lib/dashboard-search";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "arrow-right-left": ArrowRightLeft, "audio-lines": AudioLines, "audio-waveform": AudioWaveform, bell: Bell, bot: Bot, "bot-message-square": BotMessageSquare,
  "book-user": BookUser, briefcase: Briefcase, "building-2": Building2, "calendar-days": CalendarDays, "chart-column": ChartColumn, compass: Compass, contact: Contact,
  cpu: Cpu, "credit-card": CreditCard, "file-chart-column": FileChartColumn, "folder-open": FolderOpen, hash: Hash, headphones: Headphones, headset: Headset,
  home: Home, "id-card": IdCard, "key-round": KeyRound, "layout-dashboard": LayoutDashboard, "layout-template": LayoutTemplate, "list-checks": ListChecks,
  "list-filter": ListFilter, "list-todo": ListTodo, magnet: Magnet, mail: Mail, "messages-square": MessagesSquare, monitor: Monitor, "notebook-pen": NotebookPen,
  phone: Phone, "phone-call": PhoneCall, "phone-forwarded": PhoneForwarded, "phone-incoming": PhoneIncoming, plug: Plug, receipt: Receipt, "scan-eye": ScanEye,
  search: Search, settings: Settings, "shield-check": ShieldCheck, smartphone: Smartphone, sparkles: Sparkles, "square-kanban": SquareKanban, upload: Upload,
  "user-round": UserRound, users: Users, "users-round": UsersRound, video: Video, wallet: Wallet, "wand-sparkles": WandSparkles, workflow: Workflow,
  "file-audio": FileAudio,
};
const iconFor = (name: string) => ICONS[name] ?? Search;
const LABEL = Object.fromEntries(DASH_CATEGORIES.map((c) => [c.id, c.label])) as Record<DashCategory, string>;
const POPULAR: Record<"user" | "admin", string[]> = {
  user: ["/calls", "/calls?tab=phone", "/ask", "/calendar", "/studio", "/call-tree", "/billing", "/settings"],
  admin: ["/admin", "/admin/communications", "/admin/contacts", "/admin/leads", "/admin/live-agents", "/admin/billing", "/admin/users", "/admin/settings"],
};

export type SearchRecording = { id: string; title: string; source: string; createdAt: string };
export type DashboardSearchProps = {
  mode: "user" | "admin"; permissions: string[]; phoneLine?: boolean; liveAgent?: boolean; recordings?: SearchRecording[];
  /** Only one instance per page listens for "/" and Ctrl/Cmd+K. */
  hotkeys?: boolean; className?: string;
};

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const noop = () => () => {};
const speechCtor = () => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
type Hit = DashEntry | (DashEntry & { recording: true });
const recordingEntry = (r: SearchRecording): Hit => ({
  cat: "recordings", title: r.title, href: `/recordings/${r.id}`, icon: r.source === "phone_call" ? "phone" : r.source === "meeting" ? "video" : "file-audio",
  desc: `Recording · ${new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, recording: true,
});

// The search in the dashboards' top bar (left of the color-mode toggle). Same
// panel as the website's: pick an area, type or speak, arrow keys and Enter.
export function DashboardSearch({ mode, permissions, phoneLine = false, liveAgent = false, recordings = [], hotkeys = false, className }: DashboardSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<DashCategory>(mode === "admin" ? "admin" : "all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const voice = useSyncExternalStore(noop, () => speechCtor() !== null, () => false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const input = useRef<HTMLInputElement>(null);
  const rec = useRef<Recognition | null>(null);

  const entries = useMemo(() => visibleEntries({ permissions, phoneLine, liveAgent }), [permissions, phoneLine, liveAgent]);
  const cats = useMemo(() => DASH_CATEGORIES.filter((c) => c.id === "all" || entries.some((e) => e.cat === c.id)), [entries]);
  const recEntries = useMemo(() => recordings.map(recordingEntry), [recordings]);

  const results = useMemo(() => {
    const pages = searchDash(entries, q, cat, 8);
    const recs = cat === "all" || cat === "recordings" ? searchDash(recEntries, q, "all", cat === "recordings" ? 10 : 4) : [];
    return [...pages, ...recs] as Hit[];
  }, [entries, recEntries, q, cat]);
  const suggestions = useMemo(() => {
    if (cat === "all") return POPULAR[mode].map((h) => entries.find((e) => e.href === h)).filter((e): e is DashEntry => Boolean(e));
    return entries.filter((e) => e.cat === cat).slice(0, 10);
  }, [cat, entries, mode]);

  const term = q.trim();
  // Rows the arrow keys move through: Ask Echo, results, then a full search.
  const rows = useMemo(() => [
    ...(mode === "user" ? [{ kind: "ask" as const }] : []),
    ...results.map((e) => ({ kind: "result" as const, e })),
    ...(mode === "user" && term ? [{ kind: "full" as const }] : []),
  ], [results, term, mode]);

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys]);
  useEffect(() => {
    if (!open) { rec.current?.stop(); return; }
    input.current?.focus();
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  const close = () => setOpen(false);
  const go = (href: string) => { close(); router.push(href); };
  const askHref = `/ask?q=${encodeURIComponent(term)}`;
  const fullHref = `/search?q=${encodeURIComponent(term)}`;

  const listen = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => { setQ(Array.from(e.results).map((x) => x[0].transcript).join(" ")); setActive(0); };
    r.onend = () => setListening(false);
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
      if (!term) return;
      const row = rows[active];
      if (!row || row.kind === "ask") go(mode === "user" ? askHref : results[0]?.href ?? "/admin");
      else if (row.kind === "result") go(row.e.href);
      else go(fullHref);
    }
  };

  const panel = open && mounted && createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">
      <button type="button" aria-label="Close search" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]" />
      <div role="search" className="relative max-h-[100dvh] overflow-y-auto border-b bg-background pt-[env(safe-area-inset-top)] shadow-xl">
        <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6">
          <div className="flex items-start gap-2">
            <div className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:justify-center" role="tablist" aria-label="Search in">
              {cats.map((c) => {
                const Icon = iconFor(c.icon);
                return (
                  <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => { setCat(c.id); setActive(0); input.current?.focus(); }}
                    className={cn("flex shrink-0 flex-col items-center gap-1.5 border-b-2 px-3 pt-1 pb-2 text-xs transition-colors sm:text-sm",
                      cat === c.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                    <Icon className="size-5" />{c.label}
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" size="icon" aria-label="Close search" onClick={close}><X className="size-5" /></Button>
          </div>

          <div className="flex items-center gap-1 rounded-full border bg-background p-1.5 pl-5 shadow-md ring-foreground/10 focus-within:ring-2">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
              placeholder={listening ? "Listening…" : cat === "all" ? (mode === "admin" ? "Search the admin and your dashboard" : "Search pages, calls, recordings and settings") : `Search ${LABEL[cat]}`}
              aria-label="Search the dashboard" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground" />
            {q && <Button variant="ghost" size="icon-sm" aria-label="Clear" onClick={() => { setQ(""); input.current?.focus(); }}><X /></Button>}
            {voice && (
              <Button variant="ghost" size="icon" aria-label={listening ? "Stop listening" : "Search by voice"} aria-pressed={listening} onClick={listen}
                className={cn("rounded-full", listening && "bg-red-500/15 text-red-600 dark:text-red-400")}>
                <Mic className={cn("size-5", listening && "animate-pulse")} />
              </Button>
            )}
            {mode === "user" && (
              <Button className="h-11 rounded-full px-4" disabled={!term} onClick={() => go(askHref)} aria-label="Ask Echo">
                <Sparkles /><span className="hidden sm:inline">Ask Echo</span>
              </Button>
            )}
          </div>

          {term ? (
            <ul className="space-y-0.5" role="listbox" aria-label="Results">
              {rows.map((row, i) => {
                const on = i === active;
                const cls = cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", on ? "bg-muted" : "hover:bg-muted/60");
                if (row.kind === "ask") return (
                  <li key="ask" role="option" aria-selected={on}>
                    <Link href={askHref} onClick={close} className={cls} onMouseEnter={() => setActive(i)}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"><Sparkles className="size-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">Ask Echo: “{term}”</span><span className="block text-xs text-muted-foreground">An answer from your recordings and calls</span></span>
                    </Link>
                  </li>
                );
                if (row.kind === "full") return (
                  <li key="full" role="option" aria-selected={on}>
                    <Link href={fullHref} onClick={close} className={cls} onMouseEnter={() => setActive(i)}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border"><FileAudio className="size-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">Search transcripts for “{term}”</span><span className="block text-xs text-muted-foreground">Every word in your recordings, summaries and action items</span></span>
                    </Link>
                  </li>
                );
                const Icon = iconFor(row.e.icon);
                return (
                  <li key={row.e.href + row.e.title} role="option" aria-selected={on}>
                    <Link href={row.e.href} onClick={close} className={cls} onMouseEnter={() => setActive(i)}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border"><Icon className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{row.e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{row.e.desc}</span>
                      </span>
                      <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{LABEL[row.e.cat]}</span>
                    </Link>
                  </li>
                );
              })}
              {!results.length && <li className="px-3 py-2 text-sm text-muted-foreground">No pages match.{mode === "user" ? " Press Enter to ask Echo." : " Try another word."}</li>}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{cat === "all" ? "Popular" : LABEL[cat]}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((e) => {
                  const Icon = iconFor(e.icon);
                  return (
                    <Link key={e.href + e.title} href={e.href} onClick={close} className="flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span>
                      <span className="min-w-0"><span className="block text-sm font-medium">{e.title}</span><span className="block text-xs text-muted-foreground">{e.desc}</span></span>
                    </Link>
                  );
                })}
              </div>
              <p className="hidden px-1 pt-1 text-xs text-muted-foreground sm:block">Tip: press <kbd className="rounded border px-1">/</kbd> or <kbd className="rounded border px-1">Ctrl K</kbd> anywhere to search{voice ? ", or tap the mic" : ""}.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search" aria-expanded={open} aria-keyshortcuts="/ Control+K" title="Search (/)" className={className} onClick={() => setOpen(true)}>
        <Search className="size-5" />
      </Button>
      {panel}
    </>
  );
}
