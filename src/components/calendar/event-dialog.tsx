"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { deleteCalendarEvent, saveCalendarEvent } from "@/lib/actions";
import { spaceLabel } from "@/lib/format";
import type { CalendarEvent, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EventDraft = {
  id?: string; workspaceId: string; recordingId?: string | null; kind: CalendarEvent["kind"]; title: string;
  date: string; endDate: string; start: string; end: string; allDay: boolean; location: string; notes: string; attendees: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const plusHour = (t: string) => { const [h, m] = t.split(":").map(Number); return `${pad(Math.min(23, h + 1))}:${pad(m)}`; };

export function draftFromEvent(e: CalendarEvent): EventDraft {
  const s = new Date(e.startsAt), en = new Date(e.endsAt);
  return {
    id: e.id, workspaceId: e.workspaceId, recordingId: e.recordingId, kind: e.kind, title: e.title, date: localDay(s), endDate: localDay(en),
    start: localTime(s), end: localTime(en), allDay: e.allDay, location: e.location ?? "", notes: e.notes ?? "", attendees: e.attendees.join(", "),
  };
}
export function blankDraft(workspaceId: string, date = localDay(new Date())): EventDraft {
  return { workspaceId, kind: "appointment", title: "", date, endDate: date, start: "09:00", end: "10:00", allDay: false, location: "", notes: "", attendees: "" };
}

const KINDS: [CalendarEvent["kind"], string][] = [["appointment", "Appointment"], ["event", "Event"], ["deadline", "Deadline"]];

// Add or edit an appointment, event or deadline.
export function EventDialog({ draft, workspaces, onClose, onSaved }: { draft: EventDraft; workspaces: Workspace[]; onClose: () => void; onSaved?: () => void }) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const multiDay = d.endDate !== d.date;

  function save() {
    const endDate = d.endDate < d.date ? d.date : d.endDate;
    const startsAt = new Date(`${d.date}T${d.allDay ? "00:00" : d.start}:00`);
    const endsAt = new Date(`${endDate}T${d.allDay ? "23:59" : d.end || plusHour(d.start)}:00`);
    start(async () => {
      const r = await saveCalendarEvent({
        id: d.id, workspaceId: d.workspaceId, recordingId: d.recordingId, kind: d.kind, title: d.title, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
        allDay: d.allDay, location: d.location, notes: d.notes, attendees: d.attendees.split(",").map((a) => a.trim()).filter(Boolean),
      });
      if (r.error) setError(r.error); else { onSaved?.(); onClose(); }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={d.id ? "Edit" : "Add to calendar"} className="sm:max-w-lg">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {KINDS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => set("kind", k)} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium", d.kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-title">Title</Label><Input id="ev-title" required autoFocus value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Site visit with Dana" /></div>
          {workspaces.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="ev-ws">Calendar</Label>
              <Pick id="ev-ws" label="Calendar" value={d.workspaceId} onChange={(v) => set("workspaceId", v)} disabled={Boolean(d.recordingId)}
                options={workspaces.map((w) => ({ value: w.id, label: w.isPersonal ? "Personal (only you)" : `${spaceLabel(w)} (team)` }))} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={d.allDay} onCheckedChange={(v) => set("allDay", v)} /> All day</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={multiDay} onCheckedChange={(v) => set("endDate", v ? localDay(new Date(Date.parse(`${d.date}T12:00:00`) + 86400000)) : d.date)} /> Several days</label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ev-date">{multiDay ? "Starts" : "Date"}</Label><DatePicker id="ev-date" value={d.date} onChange={(v) => setD((x) => ({ ...x, date: v, endDate: x.endDate < v || x.endDate === x.date ? v : x.endDate }))} /></div>
            {multiDay && <div className="space-y-1.5"><Label htmlFor="ev-end-date">Ends</Label><DatePicker id="ev-end-date" value={d.endDate} onChange={(v) => set("endDate", v)} /></div>}
            {!d.allDay && <>
              <div className="space-y-1.5"><Label htmlFor="ev-start">Start time</Label><TimePicker id="ev-start" value={d.start} onChange={(v) => setD((x) => ({ ...x, start: v, end: x.end <= v ? plusHour(v) : x.end }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="ev-end">End time</Label><TimePicker id="ev-end" value={d.end} onChange={(v) => set("end", v)} /></div>
            </>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-loc">Location or link</Label><Input id="ev-loc" value={d.location} onChange={(e) => set("location", e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ev-who">People</Label><Input id="ev-who" value={d.attendees} onChange={(e) => set("attendees", e.target.value)} placeholder="Names or emails, comma separated" /></div>
          <div className="space-y-1.5"><Label htmlFor="ev-notes">Notes</Label><Textarea id="ev-notes" rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : d.id ? "Save" : "Add to calendar"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            {d.id && <Button type="button" variant="ghost" className="ml-auto text-destructive" disabled={pending} onClick={() => confirm(`Delete "${d.title}"?`) && start(async () => { const r = await deleteCalendarEvent(d.id!); if (r.error) setError(r.error); else { onSaved?.(); onClose(); } })}><Trash2 /> Delete</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
