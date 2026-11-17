"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Loader2, MapPin, MessageSquare, Phone, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PICK_KEY, toDigits, type NumberResult } from "./keypad";

// Search real, available phone numbers and pick one. Nothing is bought here:
// the pick is remembered in this browser for checkout, and the number is
// bought only after payment (TODO: wire into checkout once Stripe is back).
// Numbers aren't held, so one can be taken by someone else meanwhile.

const AREAS = [
  { code: "480", place: "Phoenix East Valley" }, { code: "602", place: "Phoenix" }, { code: "623", place: "Phoenix West Valley" },
  { code: "520", place: "Tucson" }, { code: "212", place: "New York" }, { code: "310", place: "Los Angeles" },
  { code: "312", place: "Chicago" }, { code: "512", place: "Austin" }, { code: "305", place: "Miami" },
];

type Picked = { number: string; display: string; place: string | null; at: number };
const listeners = new Set<() => void>();
const readPick = () => { try { return localStorage.getItem(PICK_KEY); } catch { return null; } };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
function savePick(p: Picked | null) {
  try { if (p) localStorage.setItem(PICK_KEY, JSON.stringify(p)); else localStorage.removeItem(PICK_KEY); } catch {}
  listeners.forEach((fn) => fn());
}

// Shows the letters a number spells when the search was a word, e.g. 480-CALL-NOW.
function highlight(display: string, number: string, query: string) {
  const digits = toDigits(query);
  if (!digits) return display;
  const at = number.slice(2).indexOf(digits);
  if (at < 0) return display;
  let seen = 0;
  return [...display].map((ch, i) => {
    if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
    const idx = seen++;
    const inside = idx >= at && idx < at + digits.length;
    return <span key={i} className={cn(inside && "rounded-sm bg-primary/15 font-semibold text-foreground")}>{inside && /[a-z]/i.test(query) ? query.replace(/[^a-z0-9]/gi, "")[idx - at]?.toUpperCase() ?? ch : ch}</span>;
  });
}

export function NumberPicker({ compact = false }: { compact?: boolean }) {
  const [kind, setKind] = useState<"local" | "tollfree">("local");
  const [area, setArea] = useState("");
  const [contains, setContains] = useState("");
  const [results, setResults] = useState<NumberResult[] | null>(null);
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const raw = useSyncExternalStore(subscribe, readPick, () => null);
  const picked = (() => { try { return raw ? (JSON.parse(raw) as Picked) : null; } catch { return null; } })();

  const run = useCallback((a: string, c: string, k: "local" | "tollfree") => start(async () => {
    setNote(undefined);
    const qs = new URLSearchParams({ type: k, ...(a ? { area: a } : {}), ...(c ? { contains: c } : {}) });
    const res = await fetch(`/api/numbers/search?${qs}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { numbers?: NumberResult[]; note?: string; error?: string } | null;
    if (!res || !data) { setResults([]); setNote("Couldn't search right now. Try again."); return; }
    setResults(data.numbers ?? []);
    setNote(data.error ?? data.note);
  }), []);
  const search = (a = area, c = contains, k = kind) => run(a, c, k);

  // A first look on /numbers: local numbers in the first area code.
  useEffect(() => { if (!compact) run(AREAS[0].code, "", "local"); }, [compact, run]);

  return (
    <div className="space-y-5">
      {picked && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <Check className="size-5 text-emerald-700 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold tabular-nums">{picked.display}</p>
            <p className="text-xs text-muted-foreground">Your pick{picked.place ? ` · ${picked.place}` : ""}. It&apos;s yours once you choose a plan; numbers aren&apos;t held, so finish soon.</p>
          </div>
          <Button size="sm" nativeButton={false} render={<Link href="/pricing" />}>Choose a plan</Button>
          <Button size="sm" variant="ghost" onClick={() => savePick(null)} aria-label="Clear my pick"><X /></Button>
        </div>
      )}

      <form className="space-y-3 rounded-2xl border bg-background p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 text-sm sm:w-fit">
          {(["local", "tollfree"] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setKind(k); setArea(k === "tollfree" ? "" : area); search(k === "tollfree" ? "" : area, contains, k); }}
              className={cn("flex-1 rounded-md px-3 py-1 font-medium sm:flex-none", kind === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {k === "local" ? "Local" : "Toll-free"}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
          <Input inputMode="numeric" maxLength={3} placeholder={kind === "local" ? "Area code" : "800, 888…"} value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} aria-label="Area code" />
          <Input placeholder="Digits or a word, e.g. 2255 or CALL" maxLength={10} value={contains} onChange={(e) => setContains(e.target.value)} aria-label="Digits or a word the number should contain" />
          <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Search />} Search</Button>
        </div>
        {kind === "local" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {AREAS.map((a) => (
              <button key={a.code} type="button" onClick={() => { setArea(a.code); search(a.code); }} title={a.place}
                className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium tabular-nums", area === a.code ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {a.code} <span className="font-normal opacity-70">{a.place}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {pending && !results ? <p className="text-sm text-muted-foreground">Looking for numbers…</p> : results && (
        results.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{note ?? "No numbers matched. Try a nearby area code or fewer letters."}</p> : (
          <>
            {note && <p className="text-sm text-muted-foreground">{note}</p>}
            <ul className={cn("grid gap-3 sm:grid-cols-2", !compact && "lg:grid-cols-3")}>
              {results.map((n) => {
                const mine = picked?.number === n.number;
                const place = [n.locality, n.region].filter(Boolean).join(", ") || (n.tollFree ? "Toll-free" : null);
                return (
                  <li key={n.number} className={cn("flex flex-col gap-3 rounded-2xl border bg-background p-4", mine && "border-emerald-500/60")}>
                    <div>
                      <p className="flex items-center gap-2 text-lg font-semibold tabular-nums"><Phone className="size-4 text-muted-foreground" />{highlight(n.display, n.number, contains)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {place && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {place}</span>}
                        {n.sms && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> Calls and texts</span>}
                      </p>
                    </div>
                    <Button size="sm" variant={mine ? "secondary" : "outline"} className="mt-auto" disabled={mine}
                      onClick={() => savePick({ number: n.number, display: n.display, place, at: Date.now() })}>
                      {mine ? <><Check /> Picked</> : "Pick this number"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )
      )}
      <p className="text-xs text-muted-foreground">Real numbers available right now. We buy your number only after you choose a plan. Want to keep the number you have? You can <Link href="/home-phone" className="underline underline-offset-2">bring it to Redial</Link> instead.</p>
    </div>
  );
}
