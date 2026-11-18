"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  ArrowDown, ArrowDownUp, ArrowUp, ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Map as MapIcon, Search, Table2, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { cn } from "@/lib/utils";

// One layout for every list in the dashboards (user, admin, Agent Desk):
// search, filter chips, sort, and five views (list, table, cards, map,
// calendar). Every row has a checkbox; ticking rows brings up the quick-action
// bar at the bottom of the screen. Clicking a row opens its preview in a side
// sheet (bottom sheet on phones). Map and calendar appear when the page gives
// a location or a date for its items. Built from Admin → Live Agents.

const AgentsMap = dynamic(() => import("@/components/live-agents/agents-map").then((m) => m.AgentsMap), {
  ssr: false, loading: () => <div className="h-[60dvh] min-h-80 w-full animate-pulse rounded-xl border bg-muted/40" />,
});

export type CollectionColumn<T> = {
  id: string; label: string; cell: (row: T) => React.ReactNode;
  /** Makes the column sortable (and adds it to the Sort menu). */
  sort?: (row: T) => string | number | null; className?: string;
};
export type CollectionFilter<T> = { id: string; label: string; test: (row: T) => boolean };
export type CollectionAction<T> = {
  label: string; icon: LucideIcon; run: (rows: T[]) => unknown; destructive?: boolean;
  /** Only when exactly one row is ticked (Edit, Contact…). */
  single?: boolean; show?: (rows: T[]) => boolean;
};

type View = "list" | "table" | "cards" | "map" | "calendar";
const VIEWS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "list", label: "List", icon: List }, { id: "table", label: "Table", icon: Table2 }, { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "map", label: "Map", icon: MapIcon }, { id: "calendar", label: "Calendar", icon: CalendarDays },
];

export type CollectionProps<T> = {
  items: T[];
  getId: (row: T) => string;
  title: (row: T) => string;
  subtitle?: (row: T) => React.ReactNode;
  /** Photo, initials or an icon, shown in every view. */
  media?: (row: T) => React.ReactNode;
  badge?: (row: T) => React.ReactNode;
  /** Small details: right side of a list row, foot of a card. */
  meta?: (row: T) => React.ReactNode;
  columns: CollectionColumn<T>[];
  searchText: (row: T) => string;
  filters?: CollectionFilter<T>[];
  /** Turns on the map view. */
  location?: (row: T) => { lat: number; lng: number } | null;
  /** Turns on the calendar view (ISO date or datetime). */
  date?: (row: T) => string | null;
  actions?: CollectionAction<T>[];
  /** What the side sheet shows when a row is clicked. */
  preview?: (row: T, close: () => void) => React.ReactNode;
  previewActions?: (row: T, close: () => void) => React.ReactNode;
  /** Instead of a preview (e.g. a page of its own). */
  onOpen?: (row: T) => void;
  /** Remembers the view in this browser. */
  storageKey: string;
  defaultView?: View;
  toolbar?: React.ReactNode;
  noun?: [string, string];
  empty?: string;
};

function useView(key: string, fallback: View, allowed: View[]) {
  const k = `redial.view.${key}`;
  const read = () => { try { const v = localStorage.getItem(k) as View | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; } };
  const view = useSyncExternalStore((fn) => { window.addEventListener(k, fn); return () => window.removeEventListener(k, fn); }, read, () => fallback);
  const set = (v: View) => { try { localStorage.setItem(k, v); } catch {} window.dispatchEvent(new Event(k)); };
  return [allowed.includes(view) ? view : fallback, set] as const;
}

export function CollectionView<T>(p: CollectionProps<T>) {
  const allowed = VIEWS.filter((v) => (v.id !== "map" || p.location) && (v.id !== "calendar" || p.date)).map((v) => v.id);
  const [view, setView] = useView(p.storageKey, p.defaultView ?? "table", allowed);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(p.filters?.[0]?.id ?? "");
  const sortable = p.columns.filter((c) => c.sort);
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [one, many] = p.noun ?? ["item", "items"];

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const f = p.filters?.find((x) => x.id === filter);
    const out = p.items.filter((r) => (!f || f.test(r)) && (!words.length || words.every((w) => p.searchText(r).toLowerCase().includes(w))));
    const col = sort ? p.columns.find((c) => c.id === sort.id) : undefined;
    if (!sort || !col?.sort) return out;
    return [...out].sort((x, y) => {
      const a = col.sort!(x), b = col.sort!(y);
      const cmp = a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [p, q, filter, sort]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((r) => selected.has(p.getId(r)));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); shown.forEach((r) => (allShown ? n.delete(p.getId(r)) : n.add(p.getId(r)))); return n; });
  const onSort = (id: string) => setSort((s) => (s?.id === id ? { id, dir: s.dir === "asc" ? "desc" : "asc" } : { id, dir: "asc" }));
  const picked = p.items.filter((r) => selected.has(p.getId(r)));
  const open = (r: T) => (p.onOpen ? p.onOpen(r) : p.preview ? setOpenId(p.getId(r)) : undefined);
  const current = openId ? p.items.find((r) => p.getId(r) === openId) ?? null : null;
  const v: ViewProps<T> = { ...p, rows: shown, selected, toggle, open };

  return (
    <div className={cn("space-y-4", picked.length > 0 && "pb-28")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${many}`} className="pl-8" aria-label={`Search ${many}`} />
        </div>
        {sortable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}><ArrowDownUp /> {sort ? sortable.find((c) => c.id === sort.id)?.label : "Sort"}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={sort?.id ?? ""} onValueChange={(id) => setSort({ id: String(id), dir: sort?.dir ?? "asc" })}>
                {sortable.map((c) => <DropdownMenuRadioItem key={c.id} value={c.id}>{c.label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sort?.dir ?? "asc"} onValueChange={(d) => setSort((s) => ({ id: s?.id ?? sortable[0].id, dir: d as "asc" | "desc" }))}>
                <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div role="tablist" aria-label="View" className="flex rounded-lg border bg-muted/40 p-0.5">
          {VIEWS.filter((x) => allowed.includes(x.id)).map((x) => (
            <button key={x.id} role="tab" type="button" aria-selected={view === x.id} title={x.label} onClick={() => setView(x.id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground", view === x.id && "bg-background text-foreground shadow-sm")}>
              <x.icon className="size-4" /><span className="hidden lg:inline">{x.label}</span>
            </button>
          ))}
        </div>
        {p.toolbar}
      </div>

      {p.filters && p.filters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {p.filters.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={cn("rounded-full border px-3 py-1 text-sm transition-colors", filter === f.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {f.label} <span className="opacity-70">{p.items.filter(f.test).length}</span>
            </button>
          ))}
        </div>
      )}

      {view !== "table" && shown.length > 0 && p.actions?.length ? (
        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={allShown} indeterminate={!allShown && shown.some((r) => selected.has(p.getId(r)))} onCheckedChange={toggleAll} /> Select all {shown.length}
        </label>
      ) : null}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{q ? `No ${many} match that search.` : p.empty ?? `No ${many} yet.`}</p>
      ) : view === "list" ? <ListView {...v} />
        : view === "table" ? <TableView {...v} sort={sort} onSort={onSort} allShown={allShown} toggleAll={toggleAll} />
        : view === "cards" ? <CardsView {...v} />
        : view === "map" ? <MapView {...v} />
        : <CalendarView {...v} />}

      {picked.length > 0 && p.actions?.length ? (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-5xl md:bottom-6 md:left-[calc(var(--sidebar-width,0px)+1.5rem)]">
          <div className="flex items-center gap-2 rounded-2xl border bg-card/95 p-2 pl-3 shadow-lg backdrop-blur">
            <span className="shrink-0 text-sm font-medium">{picked.length} selected</span>
            {picked.length < shown.length && <Button size="sm" variant="link" className="hidden px-1 sm:inline-flex" onClick={toggleAll}>Select all {shown.length}</Button>}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              {p.actions.filter((a) => !a.show || a.show(picked)).map((a) => (
                <Button key={a.label} size="sm" variant={a.destructive ? "destructive" : "outline"} disabled={pending || (a.single && picked.length !== 1)}
                  title={a.single && picked.length !== 1 ? `Select one ${one}` : undefined}
                  onClick={() => start(async () => { await a.run(picked); if (a.destructive) setSelected(new Set()); })}>
                  <a.icon /> {a.label}
                </Button>
              ))}
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={() => setSelected(new Set())}><X /></Button>
          </div>
        </div>
      ) : null}

      {p.preview && (
        <ResponsivePanel id={`preview-${p.storageKey}`} open={Boolean(current)} onOpenChange={(o) => !o && setOpenId(null)} defaultWidth={560}
          title={current && (
            <div className="flex items-center gap-3">
              {p.media?.(current)}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{p.title(current)}</h2>
                {p.badge && <div className="mt-0.5">{p.badge(current)}</div>}
              </div>
            </div>
          )}
          actions={current && p.previewActions?.(current, () => setOpenId(null))}>
          {current && p.preview(current, () => setOpenId(null))}
        </ResponsivePanel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The views
// ---------------------------------------------------------------------------
type ViewProps<T> = CollectionProps<T> & { rows: T[]; selected: Set<string>; toggle: (id: string) => void; open: (row: T) => void };

function Pick<T>({ p, row, className }: { p: ViewProps<T>; row: T; className?: string }) {
  if (!p.actions?.length) return null;
  const id = p.getId(row);
  return (
    <span className={cn("flex items-center", className)} onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={p.selected.has(id)} onCheckedChange={() => p.toggle(id)} aria-label={`Select ${p.title(row)}`} />
    </span>
  );
}

const rowProps = <T,>(p: ViewProps<T>, row: T) => ({
  role: "button" as const, tabIndex: 0, onClick: () => p.open(row), onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && p.open(row),
});

function ListView<T>(p: ViewProps<T>) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {p.rows.map((r) => (
        <li key={p.getId(r)}>
          <div {...rowProps(p, r)} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50", p.selected.has(p.getId(r)) && "bg-primary/5")}>
            <Pick p={p} row={r} />
            {p.media?.(r)}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.title(r)}</p>
              {p.subtitle && <p className="truncate text-xs text-muted-foreground">{p.subtitle(r)}</p>}
            </div>
            {p.meta && <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">{p.meta(r)}</div>}
            {p.badge?.(r)}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TableView<T>(p: ViewProps<T> & { sort: { id: string; dir: "asc" | "desc" } | null; onSort: (id: string) => void; allShown: boolean; toggleAll: () => void }) {
  const some = !p.allShown && p.rows.some((r) => p.selected.has(p.getId(r)));
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {p.actions?.length ? <th className="w-10 px-3 py-2"><Checkbox checked={p.allShown} indeterminate={some} onCheckedChange={p.toggleAll} aria-label="Select all shown" /></th> : null}
            {p.columns.map((c) => {
              const on = p.sort?.id === c.id;
              const Icon = !on ? ArrowUpDown : p.sort!.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th key={c.id} className={cn("px-3 py-2 font-medium", c.className)} aria-sort={on ? (p.sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sort ? (
                    <button type="button" onClick={() => p.onSort(c.id)} className={cn("inline-flex items-center gap-1 hover:text-foreground", on && "text-foreground")}>
                      {c.label} <Icon className={cn("size-3", !on && "opacity-40")} />
                    </button>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {p.rows.map((r) => (
            <tr key={p.getId(r)} onClick={() => p.open(r)} className={cn("cursor-pointer hover:bg-muted/50", p.selected.has(p.getId(r)) && "bg-primary/5")}>
              {p.actions?.length ? <td className="px-3 py-2"><Pick p={p} row={r} /></td> : null}
              {p.columns.map((c) => <td key={c.id} className={cn("px-3 py-2", c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardsView<T>(p: ViewProps<T>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1800px]:grid-cols-5">
      {p.rows.map((r) => (
        <article key={p.getId(r)} {...rowProps(p, r)}
          className={cn("relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md", p.selected.has(p.getId(r)) && "ring-2 ring-primary")}>
          <div className="flex items-start gap-3">
            <Pick p={p} row={r} className="pt-1" />
            {p.media?.(r)}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.title(r)}</p>
              {p.subtitle && <p className="line-clamp-2 text-xs text-muted-foreground">{p.subtitle(r)}</p>}
            </div>
            {p.badge?.(r)}
          </div>
          {p.meta && <div className="mt-auto border-t pt-3 text-xs text-muted-foreground">{p.meta(r)}</div>}
        </article>
      ))}
    </div>
  );
}

function MapView<T>(p: ViewProps<T>) {
  const [hover, setHover] = useState<string | null>(null);
  const placed = p.rows.map((r) => ({ r, at: p.location?.(r) })).filter((x): x is { r: T; at: { lat: number; lng: number } } => Boolean(x.at));
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
      <AgentsMap agents={placed.map(({ r, at }) => ({ id: p.getId(r), handle: "", name: p.title(r), label: p.title(r), lat: at.lat, lng: at.lng }))}
        active={hover} onHover={setHover} onPick={(id) => { const r = p.rows.find((x) => p.getId(x) === id); if (r) p.open(r); }}
        className="z-0 h-[65dvh] min-h-96 w-full overflow-hidden rounded-xl border" />
      <div className="max-h-[65dvh] space-y-1 overflow-y-auto rounded-xl border bg-card p-2">
        {p.rows.map((r) => (
          <div key={p.getId(r)} {...rowProps(p, r)} onMouseEnter={() => setHover(p.getId(r))} onMouseLeave={() => setHover(null)}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-muted/60", hover === p.getId(r) && "bg-muted/60")}>
            <Pick p={p} row={r} />
            {p.media?.(r)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.title(r)}</p>
              {p.subtitle && <p className="truncate text-xs text-muted-foreground">{p.subtitle(r)}</p>}
            </div>
          </div>
        ))}
        {placed.length < p.rows.length && <p className="px-2 pt-2 text-[11px] text-muted-foreground">{p.rows.length - placed.length} without a location.</p>}
      </div>
    </div>
  );
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarView<T>(p: ViewProps<T>) {
  const dated = p.rows.map((r) => ({ r, d: p.date?.(r) })).filter((x): x is { r: T; d: string } => Boolean(x.d)).map(({ r, d }) => ({ r, at: new Date(d) }));
  const latest = dated.length ? new Date(Math.max(...dated.map((x) => x.at.getTime()))) : new Date();
  const [month, setMonth] = useState(() => new Date(latest.getFullYear(), latest.getMonth(), 1));
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const byDay = new Map<string, T[]>();
  for (const { r, at } of dated) { const k = dayKey(at); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const today = dayKey(new Date());
  const inMonth = dated.filter(({ at }) => at.getMonth() === month.getMonth() && at.getFullYear() === month.getFullYear()).sort((a, b) => a.at.getTime() - b.at.getTime());
  const go = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const chip = (r: T) => (
    <div key={p.getId(r)} {...rowProps(p, r)} className="flex cursor-pointer items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] hover:bg-muted/70">
      <Pick p={p} row={r} /> <span className="truncate">{p.title(r)}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => go(-1)}><ChevronLeft /></Button>
        <Button size="sm" variant="outline" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Button>
        <Button size="icon-sm" variant="outline" aria-label="Next month" onClick={() => go(1)}><ChevronRight /></Button>
        <h3 className="ml-1 font-semibold">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
      </div>
      <div className="hidden overflow-hidden rounded-xl border sm:block">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const k = dayKey(d);
            const items = byDay.get(k) ?? [];
            return (
              <div key={k} className={cn("min-h-24 space-y-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", d.getMonth() !== month.getMonth() && "bg-muted/20 text-muted-foreground")}>
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", k === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                {items.slice(0, 3).map(chip)}
                {items.length > 3 && <p className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} more</p>}
              </div>
            );
          })}
        </div>
      </div>
      {/* Phones: the month as an agenda. */}
      <div className="space-y-2 sm:hidden">
        {inMonth.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing this month.</p>}
        {inMonth.map(({ r, at }) => (
          <div key={p.getId(r)} {...rowProps(p, r)} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3">
            <Pick p={p} row={r} />
            <div className="w-12 shrink-0 text-center"><p className="text-xs text-muted-foreground">{at.toLocaleDateString("en-US", { weekday: "short" })}</p><p className="text-lg font-semibold">{at.getDate()}</p></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.title(r)}</p>{p.subtitle && <p className="truncate text-xs text-muted-foreground">{p.subtitle(r)}</p>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
