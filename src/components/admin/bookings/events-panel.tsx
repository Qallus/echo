"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Copy, Download, ExternalLink, List, Mail, Pencil, Plus, Trash2, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { addRegistration, deleteEvent, saveEvent, setRegistrationStatus } from "@/lib/admin/actions/bookings";
import { EVENT_LOCATIONS, EVENT_STATUSES, eventWhen, type EventRow, type Registration } from "@/lib/bookings/events";
import { utcToZoned } from "@/lib/bookings/time";
import { slugify } from "@/lib/bookings/types";
import { downloadCsv } from "@/lib/crm/csv";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "@/components/admin/comms/compose-dialog";
import { EmptyState, RecordCalendar, ViewSwitcher } from "@/components/admin/crm/crm-kit";
import { SELECT } from "@/components/admin/crm/crm-ui";

const VIEWS = [{ id: "list" as const, label: "List", icon: List }, { id: "calendar" as const, label: "Calendar", icon: CalendarDays }];

// Events: one-day or multi-day, with a public page and registrations.
export function EventsPanel({ events, registrations, staff, timezone, siteUrl, readOnly, nowIso }: {
  events: EventRow[]; registrations: Registration[]; staff: StaffOption[]; timezone: string; siteUrl: string; readOnly: boolean; nowIso: string;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [range, setRange] = useState<"upcoming" | "past">("upcoming");
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const count = (id: string) => registrations.filter((r) => r.event_id === id && r.status !== "canceled").reduce((n, r) => n + r.guests, 0);
  const shown = useMemo(() => {
    const list = events.filter((e) => (range === "upcoming" ? e.ends_at >= nowIso : e.ends_at < nowIso));
    return range === "upcoming" ? [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) : list;
  }, [events, range, nowIso]);
  const open = events.find((e) => e.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {(["upcoming", "past"] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} className={cn("rounded-md px-3 py-1 text-sm capitalize", range === r ? "bg-accent font-medium" : "text-muted-foreground")}>{r}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
          {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> New event</Button>}
        </div>
      </div>
      {view === "calendar" ? (
        <RecordCalendar items={events.filter((e) => e.status !== "canceled")} getId={(e) => e.id} getDate={(e) => new Date(e.starts_at).toLocaleDateString("en-CA", { timeZone: timezone })}
          getTitle={(e) => e.title} onOpen={setOpenId} footer="Events placed on their first day." />
      ) : shown.length === 0 ? <EmptyState message={range === "upcoming" ? "No upcoming events. Create one: a workshop, open house or webinar." : "No past events."} /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {shown.map((e) => {
            const n = count(e.id);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                <button type="button" onClick={() => setOpenId(e.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{e.title}</span>
                    <Badge className={cn("border-transparent", EVENT_STATUSES.find((s) => s.id === e.status)!.tone)}>{EVENT_STATUSES.find((s) => s.id === e.status)!.label}</Badge></span>
                  <span className="block truncate text-xs text-muted-foreground">{eventWhen(e, timezone)} · {EVENT_LOCATIONS.find((l) => l.id === e.location_kind)?.label}{e.location ? ` · ${e.location}` : ""}</span>
                </button>
                <span className="text-sm tabular-nums text-muted-foreground">{n}{e.capacity ? `/${e.capacity}` : ""} going</span>
                {e.status === "published" && <Button size="icon-sm" variant="ghost" aria-label="Copy event link" onClick={() => navigator.clipboard.writeText(`${siteUrl}/book/events/${e.slug}`)}><Copy /></Button>}
                {!readOnly && <Button size="icon-sm" variant="ghost" aria-label={`Edit ${e.title}`} onClick={() => setEditing(e)}><Pencil /></Button>}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <EventDialog event={editing === "new" ? undefined : editing} staff={staff} timezone={timezone} onClose={() => setEditing(null)} />}
      {open && <RegistrationsSheet event={open} registrations={registrations.filter((r) => r.event_id === open.id)} staff={staff} timezone={timezone} siteUrl={siteUrl}
        readOnly={readOnly} onEdit={() => { setEditing(open); setOpenId(null); }} onDelete={() => confirm(`Delete "${open.title}" and its registrations?`) && start(async () => { setMsg(await deleteEvent(open.id)); setOpenId(null); })}
        pending={pending} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function EventDialog({ event, staff, timezone, onClose }: { event?: EventRow; staff: StaffOption[]; timezone: string; onClose: () => void }) {
  const s = event ? utcToZoned(event.starts_at, timezone) : null;
  const endIso = event ? (event.all_day ? new Date(Date.parse(event.ends_at) - 86400_000).toISOString() : event.ends_at) : null;
  const e = endIso ? utcToZoned(endIso, timezone) : null;
  const [f, setF] = useState({
    title: event?.title ?? "", slug: event?.slug ?? "", summary: event?.summary ?? "", description: event?.description ?? "",
    location_kind: event?.location_kind ?? "in_person", location: event?.location ?? "", online_url: event?.online_url ?? "",
    start_date: s?.date ?? "", end_date: e?.date ?? "", start_time: s?.time ?? "09:00", end_time: e?.time ?? "12:00",
    multi: Boolean(s && e && s.date !== e.date), all_day: event?.all_day ?? false, capacity: event?.capacity ? String(event.capacity) : "",
    status: event?.status ?? "draft", registration_open: event?.registration_open ?? true, host_id: event?.host_id ?? "",
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={event ? `Edit ${event.title}` : "New event"} className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="ev-title">Title</Label><Input id="ev-title" value={f.title} onChange={(x) => set({ title: x.target.value, ...(event ? {} : { slug: slugify(x.target.value) }) })} placeholder="Echo workshop" /></div>
          <div className="space-y-1.5"><Label htmlFor="ev-slug">Link</Label><Input id="ev-slug" value={f.slug} onChange={(x) => set({ slug: slugify(x.target.value) })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-sum">Short summary</Label><Input id="ev-sum" value={f.summary} onChange={(x) => set({ summary: x.target.value })} /></div>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.multi} onCheckedChange={(v) => set({ multi: v })} /> Multi-day</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.all_day} onCheckedChange={(v) => set({ all_day: v })} /> All day</label>
          </div>
          <div className="space-y-1.5"><Label>{f.multi ? "Starts" : "Date"}</Label><DatePicker value={f.start_date} onChange={(v) => set({ start_date: v, ...(!f.multi || !f.end_date || f.end_date < v ? { end_date: v } : {}) })} /></div>
          {f.multi && <div className="space-y-1.5"><Label>Ends</Label><DatePicker value={f.end_date} onChange={(v) => set({ end_date: v })} /></div>}
          {!f.all_day && <>
            <div className="space-y-1.5"><Label>Start time</Label><TimePicker value={f.start_time} step={15} onChange={(v) => set({ start_time: v })} /></div>
            <div className="space-y-1.5"><Label>End time</Label><TimePicker value={f.end_time} step={15} onChange={(v) => set({ end_time: v })} /></div>
          </>}
          <div className="space-y-1.5"><Label htmlFor="ev-loc">Where</Label>
            <select id="ev-loc" className={SELECT} value={f.location_kind} onChange={(x) => set({ location_kind: x.target.value as EventRow["location_kind"] })}>{EVENT_LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-cap">Capacity (blank = unlimited)</Label><Input id="ev-cap" type="number" min={1} value={f.capacity} onChange={(x) => set({ capacity: x.target.value })} /></div>
          {f.location_kind !== "online" && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-addr">Address or venue</Label><Input id="ev-addr" value={f.location} onChange={(x) => set({ location: x.target.value })} /></div>}
          {f.location_kind !== "in_person" && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-url">Online link (sent to registrants, not shown publicly)</Label><Input id="ev-url" value={f.online_url} onChange={(x) => set({ online_url: x.target.value })} placeholder="https://" /></div>}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-desc">Description</Label><Textarea id="ev-desc" rows={5} value={f.description} onChange={(x) => set({ description: x.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ev-host">Host</Label>
            <select id="ev-host" className={SELECT} value={f.host_id} onChange={(x) => set({ host_id: x.target.value })}><option value="">Anyone</option>{staff.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-status">Status</Label>
            <select id="ev-status" className={SELECT} value={f.status} onChange={(x) => set({ status: x.target.value as EventRow["status"] })}>{EVENT_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}</select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.registration_open} onCheckedChange={(v) => set({ registration_open: v })} /> Registration open</label>
        </div>
        <p className="text-xs text-muted-foreground">Times are in {timezone.replace("_", " ")}. Published events appear on the booking page.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await saveEvent(event?.id ?? null, { ...f, end_date: f.multi ? f.end_date : f.start_date, host_id: f.host_id || null, timezone });
            if (r.error) setError(r.error); else onClose();
          })}>{pending ? "Saving…" : "Save event"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegistrationsSheet({ event, registrations, staff, timezone, siteUrl, readOnly, onEdit, onDelete, pending, onClose }: {
  event: EventRow; registrations: Registration[]; staff: StaffOption[]; timezone: string; siteUrl: string; readOnly: boolean;
  onEdit: () => void; onDelete: () => void; pending: boolean; onClose: () => void;
}) {
  const [adding, setAdding] = useState({ name: "", email: "", phone: "" });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [composing, setComposing] = useState(false);
  const [busy, start] = useTransition();
  const going = registrations.filter((r) => r.status !== "canceled");
  const headcount = going.reduce((n, r) => n + r.guests, 0);
  const exportCsv = () => downloadCsv(`${event.slug}-registrations.csv`, ["Name,Email,Phone,Company,Guests,Status,Registered",
    ...registrations.map((r) => [r.name, r.email, r.phone ?? "", r.company ?? "", r.guests, r.status, r.created_at.slice(0, 10)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-xl">
        <SheetTitle className="pt-4 pr-6">{event.title}</SheetTitle>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">{eventWhen(event, timezone)}{event.location ? ` · ${event.location}` : ""}{event.host_id ? ` · Host: ${ownerName(staff, event.host_id)}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            {event.status === "published" && <Button size="sm" variant="outline" nativeButton={false} render={<a href={`${siteUrl}/book/events/${event.slug}`} target="_blank" rel="noreferrer" />}><ExternalLink /> Public page</Button>}
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!registrations.length}><Download /> Export</Button>
            {!readOnly && <Button size="sm" variant="outline" disabled={!going.length} onClick={() => setComposing(true)}><Mail /> Email attendees</Button>}
            {!readOnly && <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>}
            {!readOnly && <Button size="icon-sm" variant="ghost" aria-label="Delete event" disabled={pending} onClick={onDelete}><Trash2 /></Button>}
          </div>
          <p className="text-sm font-medium">{headcount} going{event.capacity ? ` of ${event.capacity}` : ""} · {registrations.length} registrations</p>
          {registrations.length === 0 ? <EmptyState message="No registrations yet." /> : (
            <ul className="divide-y rounded-xl border">
              {registrations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
                  <span className="min-w-0 flex-1"><span className={cn("block truncate font-medium", r.status === "canceled" && "text-muted-foreground line-through")}>{r.name}{r.guests > 1 ? ` +${r.guests - 1}` : ""}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.email}{r.company ? ` · ${r.company}` : ""}</span></span>
                  <Badge variant="outline" className="capitalize">{r.status.replace("_", " ")}</Badge>
                  {!readOnly && <>
                    <Button size="icon-xs" variant="ghost" aria-label="Attended" disabled={busy} onClick={() => start(async () => setMsg(await setRegistrationStatus([r.id], "attended")))}><Check /></Button>
                    <Button size="icon-xs" variant="ghost" aria-label="No-show" disabled={busy} onClick={() => start(async () => setMsg(await setRegistrationStatus([r.id], "no_show")))}><UserX /></Button>
                    <Button size="icon-xs" variant="ghost" aria-label="Cancel registration" disabled={busy} onClick={() => start(async () => setMsg(await setRegistrationStatus([r.id], "canceled")))}><X /></Button>
                  </>}
                </li>
              ))}
            </ul>
          )}
          {!readOnly && (
            <form className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(x) => { x.preventDefault(); start(async () => { const r = await addRegistration(event.id, adding); setMsg(r); if (!r.error) setAdding({ name: "", email: "", phone: "" }); }); }}>
              <Input placeholder="Name" value={adding.name} onChange={(x) => setAdding({ ...adding, name: x.target.value })} aria-label="Name" />
              <Input placeholder="Email" type="email" value={adding.email} onChange={(x) => setAdding({ ...adding, email: x.target.value })} aria-label="Email" />
              <Button type="submit" variant="outline" disabled={busy}><Plus /> Add</Button>
              <PhoneInput placeholder="Phone (optional)" value={adding.phone} onChange={(v) => setAdding({ ...adding, phone: v })} aria-label="Phone" className="sm:col-span-2" />
            </form>
          )}
          {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        </div>
        {composing && <ComposeDialog initial={going.filter((r) => r.contact_id).map((r) => ({ id: r.contact_id!, name: r.name, email: r.email }))}
          onClose={() => setComposing(false)} />}
      </SheetContent>
    </Sheet>
  );
}
