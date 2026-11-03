"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventDialog, type EventDraft } from "@/components/calendar/event-dialog";
import { formatTime } from "@/components/ui/time-picker";
import type { CalendarEvent, Workspace } from "@/lib/types";
import type { MentionedDate } from "@/lib/visuals";

const KIND_LABEL = { appointment: "Appointment", event: "Event", deadline: "Deadline" } as const;

export function draftFromMention(m: MentionedDate, workspaceId: string, recordingId: string): EventDraft {
  return {
    workspaceId, recordingId, kind: m.kind, title: m.title, date: m.date, endDate: m.endDate ?? m.date,
    start: m.start ?? "09:00", end: m.end ?? (m.start ? `${String(Math.min(23, Number(m.start.slice(0, 2)) + 1)).padStart(2, "0")}${m.start.slice(2)}` : "10:00"),
    allDay: m.allDay, location: m.location ?? "", attendees: m.people.join(", "), notes: m.quote ? `“${m.quote}”` : "",
  };
}

// Appointments, events and deadlines the recording mentions, each one a click
// from the calendar.
export function DatesCard({ dates, events, recordingId, workspace }: { dates: MentionedDate[]; events: CalendarEvent[]; recordingId: string; workspace: Workspace }) {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const added = (m: MentionedDate) => events.find((e) => e.title === m.title && e.startsAt.slice(0, 10) <= m.date && e.endsAt.slice(0, 10) >= m.date);
  if (!dates.length && !events.length) return null;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold"><CalendarPlus className="size-4" /> Dates mentioned</h2>
        <Button size="sm" variant="ghost" render={<Link href="/calendar" />} nativeButton={false}>Open calendar</Button>
      </div>
      <ul className="divide-y">
        {dates.map((m, i) => {
          const done = added(m);
          const when = new Date(`${m.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
          return (
            <li key={i} className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="w-16 shrink-0 text-center"><p className="text-[11px] text-muted-foreground uppercase">{KIND_LABEL[m.kind]}</p></div>
              <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                <p className="font-medium">{m.title}</p>
                <p className="text-muted-foreground">
                  {when}{m.endDate && m.endDate !== m.date ? ` – ${new Date(`${m.endDate}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
                  {m.start ? ` · ${formatTime(m.start)}${m.end ? ` – ${formatTime(m.end)}` : ""}` : m.allDay ? " · All day" : ""}
                </p>
                {(m.location || m.people.length > 0) && (
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {m.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{m.location}</span>}
                    {m.people.length > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3" />{m.people.join(", ")}</span>}
                  </p>
                )}
                {m.quote && <p className="text-xs text-muted-foreground italic">“{m.quote}”</p>}
              </div>
              {done
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CalendarCheck className="size-4" /> On your calendar</span>
                : <Button size="sm" variant="outline" onClick={() => setDraft(draftFromMention(m, workspace.id, recordingId))}><CalendarPlus /> Add to calendar</Button>}
            </li>
          );
        })}
        {events.filter((e) => !dates.some((m) => added(m)?.id === e.id)).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="w-16 shrink-0 text-center"><p className="text-[11px] text-muted-foreground uppercase">{KIND_LABEL[e.kind]}</p></div>
            <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
            <span className="text-xs text-muted-foreground">{new Date(e.startsAt).toLocaleString([], { dateStyle: "medium", ...(e.allDay ? {} : { timeStyle: "short" }) })}</span>
          </li>
        ))}
      </ul>
      {draft && <EventDialog draft={draft} workspaces={[workspace]} onClose={() => setDraft(null)} />}
    </section>
  );
}
