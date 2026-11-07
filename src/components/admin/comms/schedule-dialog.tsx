"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";

const pad = (n: number) => String(n).padStart(2, "0");
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "YYYY-MM-DD" + "HH:MM" in this browser's time zone -> ISO.
const toIso = (date: string, time: string) => (date && time ? new Date(`${date}T${time}:00`).toISOString() : null);
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");

function quick(daysAhead: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return { date: dateValue(d), time: `${pad(hour)}:00` };
}

// Pick when an email or text goes out. Times are in the viewer's time zone;
// the 5-minute job sends it within a few minutes of that time.
export function ScheduleDialog({ title, summary, cronReady, onSchedule, onClose }: {
  title: string; summary: React.ReactNode; cronReady: boolean;
  onSchedule: (iso: string) => Promise<{ ok?: string; error?: string }>; onClose: (scheduled: boolean) => void;
}) {
  const [{ date, time }, setWhen] = useState(() => quick(1, 9));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const iso = toIso(date, time);
  const label = iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(Boolean(msg.ok))}>
      <DialogContent title={title} className="max-w-md">
        <div className="space-y-4">
          <div className="text-sm">{summary}</div>
          <div className="flex flex-wrap gap-1.5">
            {[{ l: "Tomorrow 9am", ...quick(1, 9) }, { l: "Tomorrow 1pm", ...quick(1, 13) }, { l: "In 2 days, 9am", ...quick(2, 9) }, { l: "Next week, 9am", ...quick(7, 9) }].map((q) => (
              <Button key={q.l} type="button" size="sm" variant={q.date === date && q.time === time ? "secondary" : "outline"} onClick={() => setWhen({ date: q.date, time: q.time })}>{q.l}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Date</Label><DatePicker value={date} onChange={(v) => setWhen({ date: v, time })} /></div>
            <div className="space-y-1.5"><Label>Time</Label><TimePicker value={time} onChange={(v) => setWhen({ date, time: v })} step={15} aria-label="Time" /></div>
          </div>
          <p className="text-xs text-muted-foreground">Times are in your time zone ({zone()}). It goes out within 5 minutes of the time you pick.</p>
          {!cronReady && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> The 5-minute background job isn&apos;t set up yet (CRON_SECRET), so scheduled sends won&apos;t go out until it is.
            </p>
          )}
          {(msg.ok || msg.error) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{msg.error ?? msg.ok}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onClose(Boolean(msg.ok))}>{msg.ok ? "Done" : "Cancel"}</Button>
            {!msg.ok && (
              <Button disabled={pending || !iso} onClick={() => iso && start(async () => setMsg(await onSchedule(iso)))}>
                <CalendarClock /> {pending ? "Scheduling…" : `Schedule for ${label}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
