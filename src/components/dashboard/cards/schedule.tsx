"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData, EventRow } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";
import { Empty, Frame } from "../kit";

// A month at a glance with dots on busy days and the picked day's agenda,
// and a simple "what's coming" list.

const KIND: Record<string, string> = { appointment: "bg-sky-500", event: "bg-violet-500", deadline: "bg-amber-500" };
const key = (d: Date) => d.toLocaleDateString("en-CA");
const time = (e: EventRow) => (e.allDay ? "All day" : new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));

export function MiniCalendarCard({ data }: { data: DashboardData }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [picked, setPicked] = useState(() => key(new Date()));
  const byDay = new Map<string, EventRow[]>();
  for (const e of data.calendar.month) { const k = key(new Date(e.startsAt)); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const today = key(new Date());
  const agenda = (byDay.get(picked) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Frame title={month.toLocaleDateString([], { month: "long", year: "numeric" })} icon={CARDS.mini_calendar.icon} href="/calendar"
      action={<span className="flex"><Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft /></Button><Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight /></Button></span>}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const k = key(d);
              const events = byDay.get(k) ?? [];
              const out = d.getMonth() !== month.getMonth();
              return (
                <button key={k} type="button" onClick={() => setPicked(k)} aria-pressed={picked === k}
                  className={cn("flex aspect-square flex-col items-center justify-center rounded-lg text-xs tabular-nums transition-colors hover:bg-muted",
                    out && "text-muted-foreground/50", k === today && "font-semibold text-primary", picked === k && "bg-primary text-primary-foreground hover:bg-primary")}>
                  {d.getDate()}
                  <span className="mt-0.5 flex h-1 gap-0.5">{events.slice(0, 3).map((e) => <span key={e.id} className={cn("size-1 rounded-full", picked === k ? "bg-primary-foreground" : KIND[e.kind] ?? "bg-muted-foreground")} />)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{new Date(`${picked}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</p>
          {!agenda.length ? <p className="text-sm text-muted-foreground">Nothing on this day.</p> : (
            <ul className="space-y-1.5 text-sm">
              {agenda.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND[e.kind] ?? "bg-muted-foreground")} />
                  <span className="min-w-0"><span className="block truncate">{e.title}</span><span className="text-xs text-muted-foreground">{time(e)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Frame>
  );
}

export function UpcomingCard({ data }: { data: DashboardData }) {
  const list = data.calendar.upcoming.slice(0, 6);
  return (
    <Frame title="Upcoming" icon={CARDS.upcoming.icon} href="/calendar">
      {!list.length ? <Empty action={<Link href="/calendar" className="text-xs underline">Add an event</Link>}>Nothing coming up.</Empty> : (
        <ul className="space-y-2 text-sm">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-center"><span className="block text-[10px] text-muted-foreground uppercase">{new Date(e.startsAt).toLocaleDateString([], { month: "short" })}</span><span className="block text-lg leading-none font-semibold">{new Date(e.startsAt).getDate()}</span></span>
              <span className={cn("h-8 w-0.5 shrink-0 rounded-full", KIND[e.kind] ?? "bg-muted-foreground")} />
              <span className="min-w-0"><span className="block truncate font-medium">{e.title}</span><span className="text-xs text-muted-foreground">{time(e)}{e.location ? ` · ${e.location}` : ""}</span></span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
