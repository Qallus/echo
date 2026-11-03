"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteBookingType, saveAvailability, saveBookingType } from "@/lib/admin/actions/bookings";
import { LOCATIONS, WEEKDAYS, slugify, type Availability, type BookingType } from "@/lib/bookings/types";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { SELECT } from "@/components/admin/crm/crm-ui";
import { TimePicker } from "@/components/ui/time-picker";

const ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu", "UTC"];

// Appointment types: what people can book on /book, how long, where, who hosts.
export function TypesPanel({ types, staff, siteUrl, readOnly }: { types: BookingType[]; staff: StaffOption[]; siteUrl: string; readOnly: boolean }) {
  const [editing, setEditing] = useState<BookingType | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">Public booking page: <a href={`${siteUrl}/book`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{siteUrl.replace(/^https?:\/\//, "")}/book</a></p>
        <Button size="icon-sm" variant="ghost" aria-label="Copy booking link" onClick={() => navigator.clipboard.writeText(`${siteUrl}/book`)}><Copy /></Button>
        <span className="ml-auto text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
        {!readOnly && <Button variant="outline" onClick={() => setEditing("new")}><Plus /> New type</Button>}
      </div>
      {types.length === 0 ? <EmptyState message="No appointment types yet. Add one (for example a 30-minute Discovery call) to open the booking page." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {types.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">{t.name}{!t.active && <Badge variant="outline">Hidden</Badge>}</p>
                <p className="text-xs text-muted-foreground">{t.minutes} min · {LOCATIONS.find((l) => l.id === t.location)?.label}{t.host_id ? ` · ${ownerName(staff, t.host_id)}` : ""} · /book/{t.slug}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Open booking page" nativeButton={false} render={<a href={`${siteUrl}/book/${t.slug}`} target="_blank" rel="noreferrer" />}><ExternalLink /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(`${siteUrl}/book/${t.slug}`)}><Copy /></Button>
              {!readOnly && <>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`} disabled={pending} onClick={() => confirm(`Delete "${t.name}"? Existing bookings stay.`) && start(async () => setMsg(await deleteBookingType(t.id)))}><Trash2 /></Button>
              </>}
            </li>
          ))}
        </ul>
      )}
      {editing && <TypeDialog type={editing === "new" ? undefined : editing} staff={staff} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TypeDialog({ type, staff, onClose }: { type?: BookingType; staff: StaffOption[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: type?.name ?? "", slug: type?.slug ?? "", description: type?.description ?? "", minutes: type?.minutes ?? 30, location: type?.location ?? "video",
    location_detail: type?.location_detail ?? "", buffer_minutes: type?.buffer_minutes ?? 15, min_notice_hours: type?.min_notice_hours ?? 4,
    max_days_ahead: type?.max_days_ahead ?? 30, host_id: type?.host_id ?? "", active: type?.active ?? true, sort: type?.sort ?? 0,
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={type ? `Edit ${type.name}` : "New appointment type"} className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="ty-name">Name</Label><Input id="ty-name" value={f.name} onChange={(e) => set({ name: e.target.value, ...(type ? {} : { slug: slugify(e.target.value) }) })} placeholder="Discovery call" /></div>
          <div className="space-y-1.5"><Label htmlFor="ty-slug">Link</Label><Input id="ty-slug" value={f.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} placeholder="discovery-call" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ty-desc">Description</Label><Textarea id="ty-desc" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ty-min">Length (minutes)</Label><Input id="ty-min" type="number" min={5} value={f.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ty-loc">Where</Label>
            <select id="ty-loc" className={SELECT} value={f.location} onChange={(e) => set({ location: e.target.value as BookingType["location"] })}>{LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ty-det">Meeting link, address or number (shown in reminders)</Label><Input id="ty-det" value={f.location_detail} onChange={(e) => set({ location_detail: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ty-host">Host</Label>
            <select id="ty-host" className={SELECT} value={f.host_id} onChange={(e) => set({ host_id: e.target.value })}><option value="">Anyone</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ty-buf">Gap between bookings (min)</Label><Input id="ty-buf" type="number" min={0} value={f.buffer_minutes} onChange={(e) => set({ buffer_minutes: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ty-notice">Minimum notice (hours)</Label><Input id="ty-notice" type="number" min={0} value={f.min_notice_hours} onChange={(e) => set({ min_notice_hours: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ty-ahead">Bookable up to (days ahead)</Label><Input id="ty-ahead" type="number" min={1} value={f.max_days_ahead} onChange={(e) => set({ max_days_ahead: Number(e.target.value) })} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.active} onCheckedChange={(v) => set({ active: v })} /> Shown on the booking page</label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => { const r = await saveBookingType(type?.id ?? null, { ...f, host_id: f.host_id || null }); if (r.error) setError(r.error); else onClose(); })}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Weekly hours, time zone and days off for every appointment type.
export function AvailabilityPanel({ initial, readOnly }: { initial: Availability; readOnly: boolean }) {
  const [a, setA] = useState(initial);
  const [off, setOff] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const setDay = (d: (typeof WEEKDAYS)[number][0], v: [string, string] | null) => {
    const days = { ...a.days };
    if (v) days[d] = v; else delete days[d];
    setA({ ...a, days });
  };
  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1.5"><Label htmlFor="av-tz">Time zone</Label>
        <select id="av-tz" className={SELECT} value={a.timezone} disabled={readOnly} onChange={(e) => setA({ ...a, timezone: e.target.value })}>{ZONES.map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}</select>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {WEEKDAYS.map(([d, label]) => {
          const hours = a.days[d];
          return (
            <div key={d} className="flex flex-wrap items-center gap-3 p-3">
              <label className="flex w-36 items-center gap-2 text-sm"><Switch checked={Boolean(hours)} disabled={readOnly} onCheckedChange={(on) => setDay(d, on ? ["09:00", "17:00"] : null)} /> {label}</label>
              {hours ? (
                <span className="flex items-center gap-2">
                  <TimePicker value={hours[0]} disabled={readOnly} step={15} onChange={(v) => setDay(d, [v, hours[1]])} className="w-36" aria-label={`${label} start`} />
                  <span className="text-muted-foreground">to</span>
                  <TimePicker value={hours[1]} disabled={readOnly} step={15} onChange={(v) => setDay(d, [hours[0], v])} className="w-36" aria-label={`${label} end`} />
                </span>
              ) : <span className="text-sm text-muted-foreground">Unavailable</span>}
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <Label>Days off</Label>
        <div className="flex flex-wrap gap-1.5">
          {a.blackout.sort().map((d) => (
            <Badge key={d} variant="secondary" className="gap-1">{d}{!readOnly && <button type="button" aria-label={`Remove ${d}`} onClick={() => setA({ ...a, blackout: a.blackout.filter((x) => x !== d) })}><X className="size-3" /></button>}</Badge>
          ))}
          {a.blackout.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <DatePicker value={off} onChange={setOff} placeholder="Add a day off" className="w-52" />
            <Button size="sm" variant="outline" disabled={!off || a.blackout.includes(off)} onClick={() => { setA({ ...a, blackout: [...a.blackout, off] }); setOff(""); }}>Add</Button>
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button disabled={pending} onClick={() => start(async () => setMsg(await saveAvailability(a)))}>{pending ? "Saving…" : "Save availability"}</Button>
          <span className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</span>
        </div>
      )}
    </div>
  );
}
