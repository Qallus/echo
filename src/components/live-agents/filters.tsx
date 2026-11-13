"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { IconByName } from "@/components/live-agents/icons";
import { RATE_RANGES, SORTS, type Filters, type Skill } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// The browse filter bar. Every choice lives in the URL (?q=&skill=&...), so
// results render on the server and links can be shared. No filters on age,
// gender, accent, appearance or other personal traits, by design.

const CHIPS = ["live-answering", "booking", "bilingual", "medical-office", "after-hours", "dispatch", "legal-intake", "order-taking"];

export function BrowseFilters({ filters: f, skills, languages }: { filters: Filters; skills: Skill[]; languages: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(f.q);
  const [more, setMore] = useState(Boolean(f.language || f.rate !== "any"));
  const [pending, start] = useTransition();

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v); else sp.delete(k);
    start(() => router.replace(`${path}${sp.size ? `?${sp}` : ""}`, { scroll: false }));
  }

  const chips = CHIPS.map((slug) => skills.find((s) => s.slug === slug)).filter((s): s is Skill => Boolean(s));
  const active = Boolean(f.q || f.skill || f.language || f.rate !== "any" || f.now);

  return (
    <div className={cn("space-y-3 rounded-2xl border bg-card p-3 transition-opacity sm:p-4", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form className="relative min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); }}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== f.q && set({ q: q.trim() || null })}
            placeholder="Search skills, industries, languages or cities" aria-label="Search Live Agents" className="h-10 pl-9" />
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={f.now} onCheckedChange={(v) => set({ now: v ? "1" : null })} /> Available now
          </label>
          <Button type="button" variant="outline" onClick={() => setMore((m) => !m)} aria-expanded={more}><SlidersHorizontal /> More filters</Button>
          <Pick label="Sort" size="default" className="w-44" value={f.sort} onChange={(v) => set({ sort: v === "best" ? null : v })} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {chips.map((s) => {
          const on = f.skill === s.slug;
          return (
            <button key={s.slug} type="button" aria-pressed={on} onClick={() => set({ skill: on ? null : s.slug })}
              className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                on ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground")}>
              <IconByName name={s.icon} className="size-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {more && (
        <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
          <Pick label="Skill" value={f.skill} onChange={(v) => set({ skill: v || null })} options={[{ value: "", label: "All skills" }, ...skills.map((s) => ({ value: s.slug, label: s.label }))]} />
          <Pick label="Language" value={f.language} onChange={(v) => set({ language: v || null })} options={[{ value: "", label: "Any language" }, ...languages.map((l) => ({ value: l, label: l }))]} />
          <Pick label="Hourly rate" value={f.rate} onChange={(v) => set({ rate: v === "any" ? null : v })} options={RATE_RANGES.map((r) => ({ value: r.id, label: r.label }))} />
        </div>
      )}

      {active && (
        <button type="button" onClick={() => { setQ(""); set({ q: null, skill: null, language: null, rate: null, now: null }); }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3" /> Clear filters
        </button>
      )}
    </div>
  );
}

export function ViewToggle({ view }: { view: Filters["view"] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const go = (v: Filters["view"]) => {
    const sp = new URLSearchParams(params.toString());
    if (v === "grid") sp.delete("view"); else sp.set("view", v);
    router.replace(`${path}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };
  const opts = [{ id: "grid", label: "Grid + map", icon: LayoutGrid }, { id: "list", label: "List", icon: List }, { id: "map", label: "Map", icon: MapIcon }] as const;
  return (
    <div className="inline-flex rounded-lg border bg-card p-1" role="group" aria-label="View">
      {opts.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" aria-pressed={view === id} onClick={() => go(id)}
          className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition", view === id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
          <Icon className="size-3.5" /> <span className={cn(id === "grid" && "hidden sm:inline")}>{label}</span>
        </button>
      ))}
    </div>
  );
}
