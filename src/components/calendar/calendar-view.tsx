"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List, Mic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarEvent, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EventDialog, blankDraft, draftFromEvent, localDay, type EventDraft } from "./event-dialog";

const KIND_COLOR: Record<CalendarEvent["kind"], string> = {
  appointment: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  event: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  deadline: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
};
const KIND_LABEL = { appointment: "Appointments", event: "Events", deadline: "Deadlines" } as const;

// Your appointments, events and deadlines across your workspaces: month or agenda.
export function CalendarView({ events, workspaces }: { events: CalendarEvent[]; workspaces: Workspace[] }) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "agenda">("month");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [kinds, setKinds] = useState<Set<CalendarEvent["kind"]>>(new Set(["appointment", "event", "deadline"]));
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const defaultWs = workspaces.find((w) => w.isPersonal)?.id ?? workspaces[0]?.id ?? "";
  const shown = useMemo(() => events.filter((e) => kinds.has(e.kind)), [events, kinds]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const today = localDay(new Date());
  const on = (day: string) => shown.filter((e) => localDay(new Date(e.startsAt)) <= day && localDay(new Date(e.endsAt)) >= day);
  const upcoming = shown.filter((e) => localDay(new Date(e.endsAt)) >= today);
  const time = (e: CalendarEvent) => (e.allDay ? "All day" : new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {view === "month" && <>
            <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
            <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
            <p className="ml-1 font-medium">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
          </>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(KIND_LABEL) as CalendarEvent["kind"][]).map((k) => (
            <button key={k} type="button" aria-pressed={kinds.has(k)} onClick={() => setKinds((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
              className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition", kinds.has(k) ? KIND_COLOR[k] : "bg-muted text-muted-foreground line-through")}>{KIND_LABEL[k]}</button>
          ))}
          <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
            <button type="button" onClick={() => setView("month")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 font-medium", view === "month" ? "bg-accent" : "text-muted-foreground")}><CalendarDays className="size-3.5" /> Month</button>
            <button type="button" onClick={() => setView("agenda")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 font-medium", view === "agenda" ? "bg-accent" : "text-muted-foreground")}><List className="size-3.5" /> Agenda</button>
          </div>
          <Button size="sm" disabled={!defaultWs} onClick={() => setDraft(blankDraft(defaultWs))}><Plus /> New</Button>
        </div>
      </div>

      {view === "month" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-xl border text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="border-b bg-muted/50 px-2 py-1.5 font-medium text-muted-foreground">{d}</div>)}
            {days.map((d, i) => {
              const day = localDay(d);
              const list = on(day);
              return (
                <div key={day} onDoubleClick={() => defaultWs && setDraft(blankDraft(defaultWs, day))}
                  className={cn("group min-h-28 border-b p-1", i % 7 && "border-l", d.getMonth() !== month.getMonth() && "bg-muted/30 text-muted-foreground")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("inline-grid size-6 place-items-center rounded-full", day === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                    {defaultWs && <button type="button" aria-label={`Add on ${day}`} onClick={() => setDraft(blankDraft(defaultWs, day))} className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted focus:opacity-100"><Plus className="size-3.5" /></button>}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <button key={e.id} type="button" onClick={() => setDraft(draftFromEvent(e))} className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-[11px]", KIND_COLOR[e.kind])}>
                        {!e.allDay && localDay(new Date(e.startsAt)) === day && <span className="font-medium">{time(e)} </span>}{e.title}
                      </button>
                    ))}
                    {list.length > 3 && <button type="button" onClick={() => setView("agenda")} className="px-1 text-[11px] text-muted-foreground hover:underline">+{list.length - 3} more</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">Nothing coming up. Add something, or use “Add to calendar” on a recording&apos;s dates.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {upcoming.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setDraft(draftFromEvent(e))} className="flex w-full items-center gap-4 p-3 text-left hover:bg-muted/50">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase">{new Date(e.startsAt).toLocaleDateString([], { month: "short" })}</p>
                  <p className="text-xl font-semibold tabular-nums">{new Date(e.startsAt).getDate()}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(e.startsAt).toLocaleDateString([], { weekday: "long" })} · {time(e)}
                    {localDay(new Date(e.endsAt)) !== localDay(new Date(e.startsAt)) && ` to ${new Date(e.endsAt).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
                <span className={cn("hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline", KIND_COLOR[e.kind])}>{KIND_LABEL[e.kind].replace(/s$/, "")}</span>
                {e.recordingId && <Link href={`/recordings/${e.recordingId}`} onClick={(ev) => ev.stopPropagation()} className="text-muted-foreground hover:text-foreground" aria-label="Open the recording"><Mic className="size-4" /></Link>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && <EventDialog draft={draft} workspaces={workspaces} onClose={() => setDraft(null)} onSaved={() => router.refresh()} />}
    </div>
  );
}
