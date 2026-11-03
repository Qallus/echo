"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, CalendarCheck, Clock, Loader2, MapPin, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { book, openDays, openTimes, type PublicType } from "../actions";

const ICON = { video: Video, phone: Phone, in_person: MapPin } as const;
const LOC = { video: "Video call", phone: "Phone call", in_person: "In person" } as const;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Pick a day, then a time, then your details. Times are shown in the
// business's time zone (labelled), since that's where the meeting happens.
export function Booker({ type }: { type: PublicType }) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Set<string> | null>(null);
  const [day, setDay] = useState<Date | undefined>();
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", notes: "", website: "" });
  const [error, setError] = useState<string>();
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tzLabel = type.timezone.split("/").pop()!.replace("_", " ");
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: type.timezone });
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: type.timezone });
  const Icon = ICON[type.location as keyof typeof ICON] ?? Video;

  useEffect(() => {
    let live = true;
    const from = new Date(month.getFullYear(), month.getMonth(), 1), to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    openDays(type.slug, ymd(from), ymd(to)).then((d) => { if (live) setDays(new Set(d)); });
    return () => { live = false; };
  }, [month, type.slug]);

  const pickDay = (d: Date | undefined) => {
    setDay(d); setTime(null); setTimes(null); setError(undefined);
    if (d) openTimes(type.slug, ymd(d)).then(setTimes);
  };

  if (doneAt) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 px-4 py-20 text-center">
        <CalendarCheck className="size-10 text-emerald-600" />
        <h1 className="text-2xl font-semibold">You&apos;re booked</h1>
        <p className="text-muted-foreground">{type.name} on {fmtDay(doneAt)} at {fmtTime(doneAt)} ({tzLabel} time). A reminder will arrive the day before.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Back to Echo</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-3">
        <Link href="/book" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All options</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{type.name}</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="size-4" /> {type.minutes} minutes</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" /> {LOC[type.location as keyof typeof LOC] ?? type.location}</p>
        {type.description && <p className="text-sm text-muted-foreground">{type.description}</p>}
        {day && time && <p className="rounded-lg border bg-muted/40 p-3 text-sm font-medium">{fmtDay(time)} at {fmtTime(time)}</p>}
      </aside>

      {!time ? (
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="rounded-2xl border p-2">
            <Calendar mode="single" selected={day} onSelect={pickDay} month={month} onMonthChange={setMonth}
              disabled={(d) => !days || !days.has(ymd(d))} className="[--cell-size:--spacing(10)]" />
            {!days && <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Finding open days…</p>}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{day ? day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Pick a day"}</p>
            <p className="text-xs text-muted-foreground">Times in {tzLabel} time</p>
            {day && !times && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {times?.length === 0 && <p className="text-sm text-muted-foreground">No open times that day.</p>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {times?.map((t) => <Button key={t} variant="outline" onClick={() => setTime(t)}>{fmtTime(t)}</Button>)}
            </div>
          </div>
        </div>
      ) : (
        <form className="max-w-lg space-y-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await book({ slug: type.slug, startsAt: time, ...form });
            if (res.error) { setError(res.error); if (/taken/i.test(res.error)) { setTime(null); if (day) pickDay(day); } }
            else setDoneAt(time);
          });
        }}>
          <Button type="button" variant="ghost" size="sm" onClick={() => setTime(null)}><ArrowLeft /> Change time</Button>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="b-name">Name</Label><Input id="b-name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="b-email">Email</Label><Input id="b-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="b-phone">Phone (for a text reminder)</Label><Input id="b-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="b-company">Company (optional)</Label><Input id="b-company" autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="b-notes">Anything we should know?</Label><Textarea id="b-notes" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <p className="text-xs text-muted-foreground">By adding a phone number you agree to a reminder text. Reply STOP to opt out.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Booking…" : "Confirm booking"}</Button>
        </form>
      )}
    </div>
  );
}
