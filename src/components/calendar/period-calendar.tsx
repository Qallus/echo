"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The shared calendar for every Calendar view: Day, Week, Month and Year.
// The page says what falls on a day (itemsOn) and how an item looks as a
// small chip (week and month cells) and as a full row (the day list, and the
// agenda that replaces the week and month grids on phones). Year shows twelve
// small months with a dot per busy day; tap a day to open it.

export type Period = "day" | "week" | "month" | "year";
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "year", label: "Year" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const at = (y: number, m: number, d: number) => new Date(y, m, d);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfWeek = (d: Date) => at(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
const range = (from: Date, n: number) => Array.from({ length: n }, (_, i) => at(from.getFullYear(), from.getMonth(), from.getDate() + i));
const monthCells = (y: number, m: number) => range(at(y, m, 1 - at(y, m, 1).getDay()), 42);

export function PeriodCalendar<T>({ itemsOn, getId, chip, row, initial, initialPeriod = "month", onAddDay, toolbar, empty = "Nothing on this day.", note }: {
  itemsOn: (day: Date) => T[];
  getId: (item: T) => string;
  chip: (item: T, day: Date) => React.ReactNode;
  row: (item: T, day: Date) => React.ReactNode;
  initial?: Date;
  initialPeriod?: Period;
  onAddDay?: (day: Date) => void;
  toolbar?: React.ReactNode;
  empty?: string;
  note?: React.ReactNode;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [cursor, setCursor] = useState(() => initial ?? new Date());
  const today = new Date();
  const y = cursor.getFullYear(), m = cursor.getMonth();

  const step = (n: number) => setCursor(
    period === "day" ? at(y, m, cursor.getDate() + n)
      : period === "week" ? at(y, m, cursor.getDate() + 7 * n)
        : period === "month" ? at(y, m + n, 1)
          : at(y + n, 0, 1),
  );
  const openDay = (d: Date) => { setCursor(d); setPeriod("day"); };
  const week = range(startOfWeek(cursor), 7);
  const title = period === "day" ? cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : period === "week" ? `${week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${week[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : period === "month" ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : String(y);
  const unit = PERIODS.find((p) => p.id === period)!.label.toLowerCase();

  // A day's items as a list (the Day view, and each day of the phone agenda).
  const dayList = (d: Date, showEmpty = true) => {
    const items = itemsOn(d);
    if (!items.length) return showEmpty ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p> : null;
    return <div className="space-y-2">{items.map((it) => <div key={getId(it)}>{row(it, d)}</div>)}</div>;
  };
  const dayHead = (d: Date) => (
    <button type="button" onClick={() => openDay(d)} className="flex items-baseline gap-2 text-sm font-semibold hover:underline">
      {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      {sameDay(d, today) && <span className="text-xs font-normal text-primary">Today</span>}
    </button>
  );
  // Phones: the week or month as an agenda of the days that have something.
  const agenda = (days: Date[]) => {
    const busy = days.filter((d) => itemsOn(d).length);
    return (
      <div className="space-y-4 sm:hidden">
        {busy.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing this {unit}.</p>}
        {busy.map((d) => <section key={d.toISOString()} className="space-y-2">{dayHead(d)}{dayList(d, false)}</section>)}
      </div>
    );
  };
  const cell = (d: Date, outside: boolean, tall: string) => {
    const items = itemsOn(d);
    return (
      <div key={d.toISOString()} className={cn("group min-w-0 space-y-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", tall, outside && "bg-muted/20 text-muted-foreground")}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => openDay(d)} aria-label={`Open ${d.toDateString()}`}
            className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs hover:bg-muted", sameDay(d, today) && "bg-primary text-primary-foreground hover:bg-primary")}>{d.getDate()}</button>
          {onAddDay && <button type="button" aria-label={`Add on ${d.toDateString()}`} onClick={() => onAddDay(d)} className="rounded px-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted focus:opacity-100">+</button>}
        </div>
        {items.slice(0, tall === "min-h-24" ? 3 : 12).map((it) => <div key={getId(it)} className="min-w-0">{chip(it, d)}</div>)}
        {tall === "min-h-24" && items.length > 3 && <button type="button" onClick={() => openDay(d)} className="px-1 text-[11px] text-muted-foreground hover:underline">+{items.length - 3} more</button>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button size="icon-sm" variant="outline" aria-label={`Previous ${unit}`} onClick={() => step(-1)}><ChevronLeft /></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <Button size="icon-sm" variant="outline" aria-label={`Next ${unit}`} onClick={() => step(1)}><ChevronRight /></Button>
          <h3 className="ml-1 truncate font-semibold">{title}</h3>
        </div>
        <div className="slide-row flex flex-wrap items-center gap-2">
          {toolbar}
          <div role="tablist" aria-label="Calendar period" className="flex shrink-0 rounded-lg border bg-muted/40 p-0.5 text-sm">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}
                className={cn("rounded-md px-2.5 py-1 font-medium", period === p.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {period === "day" && (
        <div className="space-y-2">
          {onAddDay && <Button size="sm" variant="outline" onClick={() => onAddDay(cursor)}>+ Add on this day</Button>}
          {dayList(cursor)}
        </div>
      )}

      {period === "week" && <>
        <div className="hidden overflow-hidden rounded-xl border sm:block">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs text-muted-foreground">{week.map((d) => <div key={d.toISOString()} className="px-2 py-1.5">{WEEKDAYS[d.getDay()]}</div>)}</div>
          <div className="grid grid-cols-7">{week.map((d) => cell(d, false, "min-h-64"))}</div>
        </div>
        {agenda(week)}
      </>}

      {period === "month" && <>
        <div className="hidden overflow-hidden rounded-xl border sm:block">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs text-muted-foreground">{WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
          <div className="grid grid-cols-7">{monthCells(y, m).map((d) => cell(d, d.getMonth() !== m, "min-h-24"))}</div>
        </div>
        {agenda(range(at(y, m, 1), new Date(y, m + 1, 0).getDate()))}
      </>}

      {period === "year" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, mi) => (
            <section key={mi} className="rounded-xl border p-2">
              <button type="button" onClick={() => { setCursor(at(y, mi, 1)); setPeriod("month"); }} className="mb-1 px-1 text-sm font-semibold hover:underline">
                {at(y, mi, 1).toLocaleDateString("en-US", { month: "long" })}
              </button>
              <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">{WEEKDAYS.map((d) => <span key={d}>{d[0]}</span>)}</div>
              <div className="grid grid-cols-7 text-center text-[11px]">
                {monthCells(y, mi).map((d) => {
                  if (d.getMonth() !== mi) return <span key={d.toISOString()} />;
                  const n = itemsOn(d).length;
                  return (
                    <button key={d.toISOString()} type="button" onClick={() => openDay(d)} title={n ? `${n} on ${d.toDateString()}` : d.toDateString()}
                      className={cn("relative mx-auto flex size-6 items-center justify-center rounded-full hover:bg-muted", sameDay(d, today) && "bg-primary text-primary-foreground hover:bg-primary", n > 0 && !sameDay(d, today) && "font-semibold text-foreground")}>
                      {d.getDate()}
                      {n > 0 && <span className={cn("absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full", sameDay(d, today) ? "bg-current" : "bg-primary")} />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {note}
    </div>
  );
}
