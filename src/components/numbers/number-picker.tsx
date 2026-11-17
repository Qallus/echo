"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Loader2, MapPin, MessageSquare, Phone, Search, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PICK_KEY, toDigits, type NumberResult } from "./keypad";
import { addToCart } from "@/lib/billing/cart";

// Search real, available phone numbers and get one: "Get this number" keeps
// the pick in this browser and puts a Phone number in the cart ($5/mo, or
// $2.50/mo with a Redial plan). It's bought from Twilio after payment (Stripe
// webhook -> lib/redial/numbers.ts). Numbers aren't held until then.

// Popular places by region. A chip with a city searches that city within the
// area code (Vancouver WA shares 360 with much of western Washington).
type Place = { label: string; area: string; city?: string; state?: string };
const REGIONS: { name: string; places: Place[] }[] = [
  { name: "Arizona", places: [
    { label: "Phoenix", area: "602" }, { label: "East Valley", area: "480" }, { label: "West Valley", area: "623" },
    { label: "Tucson", area: "520" }, { label: "Flagstaff", area: "928" },
  ] },
  { name: "Pacific Northwest", places: [
    { label: "Seattle", area: "206" }, { label: "Tacoma", area: "253" }, { label: "Vancouver, WA", area: "360", city: "Vancouver", state: "WA" },
    { label: "Bellevue / Everett", area: "425" }, { label: "Spokane", area: "509" }, { label: "Portland", area: "503" },
  ] },
  { name: "California & West", places: [
    { label: "Los Angeles", area: "213" }, { label: "San Francisco", area: "415" }, { label: "San Diego", area: "619" },
    { label: "San Jose", area: "408" }, { label: "Sacramento", area: "916" }, { label: "Las Vegas", area: "702" },
    { label: "Salt Lake City", area: "801" }, { label: "Denver", area: "303" },
  ] },
  { name: "Texas & Central", places: [
    { label: "Dallas", area: "214" }, { label: "Houston", area: "713" }, { label: "Austin", area: "512" }, { label: "San Antonio", area: "210" },
    { label: "Chicago", area: "312" }, { label: "Minneapolis", area: "612" }, { label: "Kansas City", area: "816" }, { label: "Detroit", area: "313" },
  ] },
  { name: "Southeast", places: [
    { label: "Atlanta", area: "404" }, { label: "Miami", area: "305" }, { label: "Orlando", area: "407" }, { label: "Tampa", area: "813" },
    { label: "Charlotte", area: "704" }, { label: "Nashville", area: "615" },
  ] },
  { name: "Northeast", places: [
    { label: "New York", area: "212" }, { label: "Brooklyn / Queens", area: "718" }, { label: "Boston", area: "617" },
    { label: "Philadelphia", area: "215" }, { label: "Washington, DC", area: "202" }, { label: "Columbus", area: "614" },
  ] },
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
  const [region, setRegion] = useState(REGIONS[0].name);
  const [place, setPlace] = useState<Place | null>(null);
  const [results, setResults] = useState<NumberResult[] | null>(null);
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const raw = useSyncExternalStore(subscribe, readPick, () => null);
  const picked = (() => { try { return raw ? (JSON.parse(raw) as Picked) : null; } catch { return null; } })();

  const run = useCallback((a: string, c: string, k: "local" | "tollfree", at?: Place | null) => start(async () => {
    setNote(undefined);
    const qs = new URLSearchParams({ type: k, ...(a ? { area: a } : {}), ...(c ? { contains: c } : {}), ...(at?.city ? { city: at.city } : {}), ...(at?.state ? { state: at.state } : {}) });
    const res = await fetch(`/api/numbers/search?${qs}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { numbers?: NumberResult[]; note?: string; error?: string } | null;
    if (!res || !data) { setResults([]); setNote("Couldn't search right now. Try again."); return; }
    setResults(data.numbers ?? []);
    setNote(data.error ?? data.note);
  }), []);
  const search = (a = area, c = contains, k = kind, at: Place | null = place?.area === a ? place : null) => run(a, c, k, at);

  // A first look on /numbers: local numbers in the first area code.
  useEffect(() => { if (!compact) run(REGIONS[0].places[0].area, "", "local"); }, [compact, run]);

  return (
    <div className="space-y-5">
      {picked && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <Check className="size-5 text-emerald-700 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold tabular-nums">{picked.display}</p>
            <p className="text-xs text-muted-foreground">In your cart{picked.place ? ` · ${picked.place}` : ""}. $5/mo, or $2.50/mo with a Redial plan. Numbers aren&apos;t held, so check out soon.</p>
          </div>
          <Button size="sm" nativeButton={false} render={<Link href="/cart" />}><ShoppingCart /> Go to cart</Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/pricing#plans" />}>Add a plan</Button>
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
          <div className="space-y-2">
            <div className="flex gap-1 overflow-x-auto pb-1 text-xs [scrollbar-width:none]" role="tablist" aria-label="Regions">
              {REGIONS.map((r) => (
                <button key={r.name} type="button" role="tab" aria-selected={region === r.name} onClick={() => setRegion(r.name)}
                  className={cn("shrink-0 rounded-md px-2.5 py-1 font-medium", region === r.name ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>{r.name}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.find((r) => r.name === region)!.places.map((p) => (
                <button key={p.label} type="button" onClick={() => { setArea(p.area); setPlace(p); run(p.area, contains, "local", p); }}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium", place?.label === p.label ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  {p.label} <span className="tabular-nums opacity-70">{p.area}</span>
                </button>
              ))}
            </div>
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
                      onClick={() => { savePick({ number: n.number, display: n.display, place, at: Date.now() }); addToCart("redial_number_monthly"); }}>
                      {mine ? <><Check /> In your cart</> : "Get this number"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )
      )}
      <p className="text-xs text-muted-foreground">Real numbers available right now: $5 a month, or $2.50 a month with any Redial plan. We set up your number as soon as you check out. Want to keep the number you have? You can <Link href="/home-phone" className="underline underline-offset-2">bring it to Redial</Link> instead.</p>
    </div>
  );
}
