"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Copy, Download, ExternalLink, Mail, Pencil, Plus, Trash2, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
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
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { CollectionView } from "@/components/collection/collection-view";
import { IconTile, muted } from "@/components/collection/kit";

const STATUS = (e: EventRow) => EVENT_STATUSES.find((s) => s.id === e.status)!;
const where = (e: EventRow) => `${EVENT_LOCATIONS.find((l) => l.id === e.location_kind)?.label ?? ""}${e.location ? ` · ${e.location}` : ""}`;

// Events: one-day or multi-day, with a public page and registrations. Clicking
// an event opens its registrations sheet (edit, delete, export, email).
export function EventsPanel({ events, registrations, staff, timezone, siteUrl, readOnly, nowIso }: {
  events: EventRow[]; registrations: Registration[]; staff: StaffOption[]; timezone: string; siteUrl: string; readOnly: boolean; nowIso: string;
}) {
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const count = (id: string) => registrations.filter((r) => r.event_id === id && r.status !== "canceled").reduce((n, r) => n + r.guests, 0);
  const upcoming = (e: EventRow) => e.ends_at >= nowIso;
  // Upcoming soonest first, then past most recent first.
  const items = useMemo(() => {
    const up = (e: EventRow) => e.ends_at >= nowIso;
    return [...events].sort((a, b) => Number(up(b)) - Number(up(a)) || (up(a) ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at)));
  }, [events, nowIso]);
  const open = events.find((e) => e.id === openId) ?? null;
  const link = (e: EventRow) => `${siteUrl}/book/events/${e.slug}`;
  const badge = (e: EventRow) => <Badge className={cn("border-transparent", STATUS(e).tone)}>{STATUS(e).label}</Badge>;
  const going = (e: EventRow) => `${count(e.id)}${e.capacity ? `/${e.capacity}` : ""} going`;
  const remove = (rows: EventRow[]) => {
    if (!confirm(rows.length === 1 ? `Delete "${rows[0].title}" and its registrations?` : `Delete ${rows.length} events and their registrations?`)) return;
    start(async () => { let last: { ok?: string; error?: string } = {}; for (const e of rows) { last = await deleteEvent(e.id); if (last.error) break; } setMsg(last); });
  };
  const exportRows = (rows: EventRow[]) => {
    const ids = new Set(rows.map((e) => e.id)), title = new Map(rows.map((e) => [e.id, e.title]));
    downloadCsv("event-registrations.csv", ["Event,Name,Email,Phone,Company,Guests,Status,Registered",
      ...registrations.filter((r) => ids.has(r.event_id)).map((r) => [title.get(r.event_id), r.name, r.email, r.phone ?? "", r.company ?? "", r.guests, r.status, r.created_at.slice(0, 10)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"));
  };

  return (
    <div className="space-y-4">
      {(msg.ok || msg.error) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      <CollectionView<EventRow>
        items={items} getId={(e) => e.id} title={(e) => e.title} noun={["event", "events"]} storageKey="admin-events" defaultView="list"
        subtitle={(e) => `${eventWhen(e, timezone)} · ${where(e)}`} media={() => <IconTile icon={CalendarDays} />} badge={badge} meta={going}
        searchText={(e) => `${e.title} ${e.summary ?? ""} ${e.location ?? ""} ${where(e)} ${STATUS(e).label}`}
        filters={[
          { id: "upcoming", label: "Upcoming", test: upcoming },
          { id: "past", label: "Past", test: (e) => !upcoming(e) },
          { id: "all", label: "All", test: () => true },
          ...EVENT_STATUSES.map((s) => ({ id: s.id, label: s.label, test: (e: EventRow) => e.status === s.id })),
        ]}
        date={(e) => e.starts_at}
        columns={[
          { id: "title", label: "Event", sort: (e) => e.title.toLowerCase(), cell: (e) => <span className="font-medium">{e.title}</span> },
          { id: "when", label: "When", sort: (e) => e.starts_at, cell: (e) => <span className="whitespace-nowrap text-muted-foreground">{eventWhen(e, timezone)}</span> },
          { id: "where", label: "Where", sort: (e) => e.location_kind, cell: (e) => <span className="block max-w-56 truncate text-muted-foreground">{where(e)}</span> },
          { id: "going", label: "Going", sort: (e) => count(e.id), cell: (e) => <span className="tabular-nums">{going(e)}</span> },
          { id: "host", label: "Host", sort: (e) => (e.host_id ? ownerName(staff, e.host_id) : null), cell: (e) => muted(e.host_id ? ownerName(staff, e.host_id) : "Anyone") },
          { id: "registration", label: "Registration", sort: (e) => Number(e.registration_open), cell: (e) => muted(e.registration_open ? "Open" : "Closed") },
          { id: "status", label: "Status", sort: (e) => e.status, cell: badge },
        ]}
        actions={[
          { label: "Copy links", icon: Copy, show: (rows) => rows.some((e) => e.status === "published"), run: (rows) => { void navigator.clipboard.writeText(rows.filter((e) => e.status === "published").map(link).join("\n")); } },
          { label: "Export registrations", icon: Download, run: exportRows },
          ...(readOnly ? [] : [
            { label: "Edit", icon: Pencil, single: true, run: ([e]: EventRow[]) => setEditing(e) },
            { label: "Delete", icon: Trash2, destructive: true, run: remove },
          ]),
        ]}
        onOpen={(e) => setOpenId(e.id)}
        empty="No events. Create one: a workshop, open house or webinar."
        toolbar={!readOnly && <Button onClick={() => setEditing("new")}><Plus /> New event</Button>}
      />
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
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title={event ? `Edit ${event.title}` : "New event"} id="event" defaultWidth={640}>
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
            <Pick id="ev-loc" label="Where" value={f.location_kind} onChange={(v) => set({ location_kind: v as EventRow["location_kind"] })} options={EVENT_LOCATIONS.map((l) => ({ value: l.id, label: l.label }))} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-cap">Capacity (blank = unlimited)</Label><Input id="ev-cap" type="number" min={1} value={f.capacity} onChange={(x) => set({ capacity: x.target.value })} /></div>
          {f.location_kind !== "online" && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-addr">Address or venue</Label><Input id="ev-addr" value={f.location} onChange={(x) => set({ location: x.target.value })} /></div>}
          {f.location_kind !== "in_person" && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-url">Online link (sent to registrants, not shown publicly)</Label><Input id="ev-url" value={f.online_url} onChange={(x) => set({ online_url: x.target.value })} placeholder="https://" /></div>}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ev-desc">Description</Label><Textarea id="ev-desc" rows={5} value={f.description} onChange={(x) => set({ description: x.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ev-host">Host</Label>
            <Pick id="ev-host" label="Host" value={f.host_id} onChange={(v) => set({ host_id: v })} options={[{ value: "", label: "Anyone" }, ...staff.map((p) => ({ value: p.user_id, label: p.name }))]} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-status">Status</Label>
            <Pick id="ev-status" label="Status" value={f.status} onChange={(v) => set({ status: v as EventRow["status"] })} options={EVENT_STATUSES.map((st) => ({ value: st.id, label: st.label }))} />
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
      </ResponsivePanel>
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
