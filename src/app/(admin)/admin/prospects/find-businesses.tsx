"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, MapPinned, Phone, Search, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { addPlaces, findPlaces, type FoundPlace } from "@/lib/admin/actions/prospects";
import { cn } from "@/lib/utils";

const money = (cents: number) => `$${(cents / 100).toFixed(cents < 100 ? 3 : 2).replace(/0$/, "")}`;
const IDEAS = ["HVAC", "Plumbers", "Dentists", "Law firms", "Auto repair", "Real estate offices", "Insurance agencies", "Veterinarians"];

// Find businesses on Google Maps by what they do and where (Google Places),
// pick the ones worth calling, and add them to the prospect list. Each page of
// up to 20 results costs one Google request and counts against the monthly cap.
export function FindBusinessesPanel({ onClose, pageCents }: { onClose: () => void; pageCents: number }) {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [next, setNext] = useState<{ token: string; page: number } | null>(null);
  const [query, setQuery] = useState("");
  const [spend, setSpend] = useState<{ spent: number; cap: number } | null>(null);
  const [tags, setTags] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const addable = results.filter((r) => r.phoneE164 && !r.onList && r.open);
  const search = (page: number, token?: string) => start(async () => {
    const q = page === 1 ? [what.trim(), where.trim()].filter(Boolean).join(" in ") : query;
    setMsg({});
    const r = await findPlaces(q, token, page);
    if (r.error) { setMsg({ error: r.error }); return; }
    const found = r.results ?? [];
    if (r.spentCents != null && r.capCents != null) setSpend({ spent: r.spentCents, cap: r.capCents });
    setQuery(q);
    setNext(r.next ? { token: r.next, page: page + 1 } : null);
    setResults((old) => (page === 1 ? found : [...old, ...found.filter((f) => !old.some((o) => o.placeId === f.placeId))]));
    // New results with a phone, not on the list and open are ticked to start.
    setPicked((old) => {
      const n = new Set(page === 1 ? [] : old);
      found.filter((f) => f.phoneE164 && !f.onList && f.open).forEach((f) => n.add(f.placeId));
      return n;
    });
    if (!found.length) setMsg({ ok: "Google found nothing for that. Try a broader category or a nearby city." });
  });
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = results.filter((r) => picked.has(r.placeId));
  const add = () => start(async () => {
    const r = await addPlaces(chosen, tags || undefined);
    setMsg(r);
    if (r.ok) {
      setResults((rs) => rs.map((x) => (picked.has(x.placeId) ? { ...x, onList: true } : x)));
      setPicked(new Set());
      router.refresh();
    }
  });

  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title="Find businesses on Google Maps" id="prospects-places" defaultWidth={720}
      description={`Search what they do and where. Each page of up to 20 businesses is one Google search (about ${money(pageCents)}), counted against your monthly cap.`}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {spend && <span className="mr-auto text-xs text-muted-foreground">This month: {money(spend.spent)} of {money(spend.cap)}</span>}
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button disabled={pending || !chosen.length} onClick={add}>{pending ? "Working…" : `Add ${chosen.length || ""} to prospects`}</Button>
        </div>
      }>
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (what.trim()) search(1); }}>
        <div className="space-y-1.5"><Label htmlFor="fb-what">What they do</Label><Input id="fb-what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="HVAC, dentists, law firms" /></div>
        <div className="space-y-1.5"><Label htmlFor="fb-where">Where</Label><Input id="fb-where" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Chandler, AZ or 85224" /></div>
        <Button type="submit" disabled={pending || !what.trim()}><Search /> {pending && !results.length ? "Searching…" : "Search"}</Button>
      </form>
      {!results.length && (
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((i) => <button key={i} type="button" onClick={() => setWhat(i)} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">{i}</button>)}
        </div>
      )}
      {(msg.ok || msg.error) && <p className={cn("rounded-lg border px-3 py-2 text-sm", msg.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40")}>{msg.error ?? msg.ok}</p>}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={addable.length > 0 && addable.every((r) => picked.has(r.placeId))}
                onCheckedChange={(v) => setPicked(v ? new Set(addable.map((r) => r.placeId)) : new Set())} />
              {results.length} found for &ldquo;{query}&rdquo;, {addable.length} can be added
            </label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags for these (optional)" className="h-8 w-56" aria-label="Tags" />
          </div>
          <ul className="divide-y rounded-xl border">
            {results.map((r) => {
              const can = Boolean(r.phoneE164) && !r.onList && r.open;
              return (
                <li key={r.placeId} className={cn("flex items-start gap-3 p-3", !can && "opacity-60")}>
                  <Checkbox className="mt-0.5" disabled={!can} checked={picked.has(r.placeId)} onCheckedChange={() => toggle(r.placeId)} aria-label={`Add ${r.name}`} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {r.name}
                      {r.onList && <Badge variant="outline">On the list</Badge>}
                      {!r.open && <Badge variant="outline">Closed</Badge>}
                      {!r.phoneE164 && <Badge variant="outline">No phone</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{[r.category, [r.address, r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {r.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {r.phone}</span>}
                      {r.rating != null && <span className="inline-flex items-center gap-1"><Star className="size-3" /> {r.rating.toFixed(1)}{r.reviews != null ? ` (${r.reviews})` : ""}</span>}
                      {r.website && <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><Globe className="size-3" /> Website</a>}
                      {r.lat != null && <span className="inline-flex items-center gap-1"><MapPinned className="size-3" /> On the map</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {next && <Button variant="outline" className="w-full" disabled={pending} onClick={() => search(next.page, next.token)}>{pending ? "Loading…" : `Load 20 more (one more search, about ${money(pageCents)})`}</Button>}
          {!next && results.length >= 20 && <p className="text-center text-xs text-muted-foreground">Google shows up to 60 per search. Narrow the area (a ZIP or a nearby city) to find more.</p>}
        </div>
      )}
    </ResponsivePanel>
  );
}
