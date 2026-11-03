"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, Search, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { STAGES, type DealStage } from "@/lib/crm/deals";
import { cn } from "@/lib/utils";
import { SELECT } from "./crm-ui";

// The Channel-Cast CRM kit (components/crm/crm-ui.tsx), on Echo's Base UI
// components: stat tiles, view switcher, search, row menu, detail rows,
// panels, click-to-edit fields and a month calendar.

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">{children}</div>;
}

export function StatTile({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="w-40 shrink-0 snap-start rounded-xl border bg-card p-4 sm:w-auto sm:min-w-0 sm:shrink">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", accent && "text-primary")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ViewSwitcher<T extends string>({ views, value, onChange }: { views: { id: T; label: string; icon: LucideIcon }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 [scrollbar-width:none]">
      {views.map((v) => (
        <button key={v.id} type="button" onClick={() => onChange(v.id)} aria-pressed={v.id === value}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            v.id === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
          <v.icon className="size-4" /> {v.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" aria-label={placeholder} />
    </div>
  );
}

export type RowAction = { label: string; icon: LucideIcon; onClick: () => void; destructive?: boolean };

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}><MoreVertical /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {actions.map((a) => (
            <DropdownMenuItem key={a.label} variant={a.destructive ? "destructive" : "default"} onClick={a.onClick}>
              <a.icon /> {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

// Label on the left, value on the right; used in drawers and record panels.
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 max-w-[65%] text-right text-sm font-medium">{children ?? <span className="text-muted-foreground/60">—</span>}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">{message}</div>;
}

export function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StageBadge({ stage }: { stage: DealStage }) {
  return <Badge className={cn("border-transparent", STAGES[stage].tone)}>{STAGES[stage].label}</Badge>;
}

// Click-to-edit value. Enter or blur saves, Escape discards.
export function Editable({ value, onSave, type = "text", options, placeholder = "—", align = "right", format }: {
  value: string | number | null | undefined; onSave: (next: string) => void; type?: "text" | "number" | "date" | "select";
  options?: { value: string; label: string }[]; placeholder?: string; align?: "left" | "right"; format?: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const current = value == null ? "" : String(value);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const commit = (next: string) => { setEditing(false); if (next !== current) onSave(next); };

  if (editing && type === "select") {
    return (
      <select autoFocus value={draft} onChange={(e) => commit(e.target.value)} onBlur={() => setEditing(false)} className={cn(SELECT, "h-7")}>
        {(options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (editing && type === "date") {
    return <DatePicker value={draft} onChange={commit} className="w-44" />;
  }
  if (editing) {
    return (
      <Input ref={ref} type={type === "number" ? "number" : "text"} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(draft); }
          if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
        }}
        className={cn("h-7 text-sm", align === "right" && "text-right")} />
    );
  }
  return (
    <button type="button" onClick={() => { setDraft(current); setEditing(true); }} title="Click to edit"
      className={cn("max-w-full truncate rounded px-1 py-0.5 text-sm transition-colors hover:bg-muted/60", align === "right" ? "text-right" : "text-left",
        current ? "text-foreground" : "text-muted-foreground/60")}>
      {current ? (format ? format(current) : current) : placeholder}
    </button>
  );
}

const parseDay = (iso: string) => new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);

// Month calendar placing records on a date (close date, created, due).
export function RecordCalendar<T>({ items, getId, getDate, getTitle, onOpen, footer }: {
  items: T[]; getId: (t: T) => string; getDate: (t: T) => string | null; getTitle: (t: T) => string; onOpen: (id: string) => void; footer?: string;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const first = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const byDay = useMemo(() => {
    const map = new Map<number, T[]>();
    for (const it of items) {
      const raw = getDate(it);
      if (!raw) continue;
      const d = parseDay(raw);
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), it]);
    }
    return map;
  }, [items, cursor, getDate]);
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const shift = (delta: number) => { const d = new Date(cursor.year, cursor.month + delta, 1); setCursor({ year: d.getFullYear(), month: d.getMonth() }); };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></Button>
        <span className="text-sm font-semibold">{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] tracking-wide text-muted-foreground uppercase">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className={cn("min-h-16 rounded-md border p-1 sm:min-h-20", day ? "border-border" : "border-transparent")}>
            {day && (
              <>
                <span className="text-xs text-muted-foreground">{day}</span>
                <div className="mt-1 space-y-1">
                  {(byDay.get(day) ?? []).map((it) => (
                    <button key={getId(it)} type="button" onClick={() => onOpen(getId(it))} title={getTitle(it)}
                      className="w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-primary">
                      {getTitle(it)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {footer && <p className="mt-2 text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
