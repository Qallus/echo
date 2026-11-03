"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, List, Plus, Table as TableIcon, Trash2, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteBookings, saveBooking, setBookingStatus } from "@/lib/admin/actions/bookings";
import { BOOKING_STATUSES, formatWhen, type Booking, type BookingStatus, type BookingType } from "@/lib/bookings/types";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { BulkBar, type BulkAction } from "@/components/admin/crm/bulk-bar";
import { EmptyState, RecordCalendar, SearchBox, StatRow, StatTile, ViewSwitcher } from "@/components/admin/crm/crm-kit";
import { SELECT } from "@/components/admin/crm/crm-ui";
import { DataTable, plain, type Column } from "@/components/admin/crm/data-table";
import { TimePicker } from "@/components/ui/time-picker";
import { PhoneInput } from "@/components/ui/phone-input";

type View = "list" | "calendar" | "table";
const VIEWS = [{ id: "list" as const, label: "List", icon: List }, { id: "calendar" as const, label: "Calendar", icon: CalendarDays }, { id: "table" as const, label: "Table", icon: TableIcon }];

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUSES.find((x) => x.id === status)!;
  return <Badge className={cn("border-transparent", s.tone)}>{s.label}</Badge>;
}

// Upcoming and past bookings (website and staff-made), in list, calendar or
// table views, with bulk status changes.
export function BookingsPanel({ bookings, types, staff, timezone, people, readOnly, nowIso }: {
  bookings: Booking[]; types: BookingType[]; staff: StaffOption[]; timezone: string; people: { id: string; name: string; email: string | null; phone: string | null }[];
  readOnly: boolean; nowIso: string;
}) {
  const [view, setView] = useState<View>("list");
  const [range, setRange] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, clear = false) => start(async () => { const r = await fn(); setMsg(r); if (!r.error && clear) setSelected(new Set()); });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = bookings.filter((b) => (range === "all" || (range === "upcoming" ? b.ends_at >= nowIso : b.ends_at < nowIso))
      && (!q || `${b.title} ${b.name} ${b.email ?? ""} ${b.company ?? ""}`.toLowerCase().includes(q)));
    return range === "upcoming" ? [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) : list;
  }, [bookings, range, search, nowIso]);
  const upcoming = bookings.filter((b) => b.starts_at >= nowIso && (b.status === "confirmed" || b.status === "pending"));
  const week = upcoming.filter((b) => b.starts_at < new Date(Date.parse(nowIso) + 7 * 86400_000).toISOString());
  const ids = [...selected];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const when = (iso: string) => formatWhen(iso, timezone);

  const bulk: BulkAction[] = readOnly ? [] : [
    { label: "Status", icon: Check, options: BOOKING_STATUSES.map((s) => ({ value: s.id, label: s.label })), onPick: (v: string) => run(() => setBookingStatus(ids, v as BookingStatus), true) },
    { label: "Delete", icon: Trash2, destructive: true, run: () => confirm(`Delete ${ids.length} bookings?`) && run(() => deleteBookings(ids), true) },
  ];
  const columns: Column<Booking>[] = [
    { id: "when", label: "When", cell: (b) => <span className="whitespace-nowrap">{when(b.starts_at)}</span>, value: (b) => b.starts_at },
    { id: "title", label: "Booking", cell: (b) => <span className="font-medium">{b.title}</span>, value: (b) => b.title },
    { id: "status", label: "Status", cell: (b) => <StatusBadge status={b.status} />, value: (b) => BOOKING_STATUSES.find((s) => s.id === b.status)!.label, filter: true },
    { id: "type", label: "Type", cell: (b) => plain(types.find((t) => t.id === b.type_id)?.name), value: (b) => types.find((t) => t.id === b.type_id)?.name ?? null, filter: true },
    { id: "email", label: "Email", cell: (b) => plain(b.email), value: (b) => b.email },
    { id: "source", label: "Source", cell: (b) => (b.source === "website" ? "Website" : "Staff"), value: (b) => (b.source === "website" ? "Website" : "Staff"), filter: true },
    { id: "host", label: "Host", cell: (b) => plain(ownerName(staff, b.host_id)), value: (b) => ownerName(staff, b.host_id), filter: true },
  ];

  return (
    <div className="space-y-5">
      <StatRow>
        <StatTile label="Upcoming" value={upcoming.length} />
        <StatTile label="Next 7 days" value={week.length} accent />
        <StatTile label="Booked online" value={bookings.filter((b) => b.source === "website").length} />
        <StatTile label="No-shows" value={bookings.filter((b) => b.status === "no_show").length} />
      </StatRow>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search bookings…" />
          <div className="flex gap-1 rounded-lg border bg-card p-1">
            {(["upcoming", "past", "all"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} className={cn("rounded-md px-3 py-1 text-sm capitalize", range === r ? "bg-accent font-medium" : "text-muted-foreground")}>{r}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
          {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> New booking</Button>}
        </div>
      </div>
      <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((b) => b.id)))} actions={bulk} />
      {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}

      {shown.length === 0 && view !== "calendar" ? <EmptyState message={range === "upcoming" ? "Nothing booked yet. Share your booking page, or add one." : "No bookings here."} /> : view === "list" ? (
        <ul className="divide-y rounded-xl border bg-card">
          {shown.map((b) => (
            <li key={b.id} className="flex items-center gap-3 p-3">
              {!readOnly && <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} aria-label={`Select ${b.title}`} />}
              <button type="button" onClick={() => setEditing(b)} className="min-w-0 flex-1 text-left">
                <span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{b.title}</span><StatusBadge status={b.status} />{b.source === "website" && <Badge variant="outline" className="text-[10px]">Online</Badge>}</span>
                <span className="block truncate text-xs text-muted-foreground">{when(b.starts_at)}{b.email ? ` · ${b.email}` : ""}{b.host_id ? ` · ${ownerName(staff, b.host_id)}` : ""}</span>
              </button>
              {b.contact_id && <Link href={`/admin/contacts/${b.contact_id}`} className="hidden text-xs text-primary hover:underline sm:block">Contact</Link>}
            </li>
          ))}
        </ul>
      ) : view === "table" ? (
        <DataTable rows={shown} columns={columns} getId={(b) => b.id} selected={selected} onSelect={setSelected} onOpen={(b) => setEditing(b)} />
      ) : (
        <RecordCalendar items={bookings.filter((b) => b.status !== "canceled")} getId={(b) => b.id} getDate={(b) => new Date(b.starts_at).toLocaleDateString("en-CA", { timeZone: timezone })}
          getTitle={(b) => `${new Date(b.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })} ${b.name}`}
          onOpen={(id) => setEditing(bookings.find((b) => b.id === id) ?? null)} footer={`Times in ${timezone.replace("_", " ")}.`} />
      )}

      {editing && <BookingDialog booking={editing === "new" ? undefined : editing} types={types} staff={staff} people={people} timezone={timezone} readOnly={readOnly} onClose={() => setEditing(null)} />}
    </div>
  );
}

function localParts(iso: string, tz: string) {
  const d = new Date(iso);
  return { date: d.toLocaleDateString("en-CA", { timeZone: tz }), time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }) };
}

function BookingDialog({ booking, types, staff, people, timezone, readOnly, onClose }: {
  booking?: Booking; types: BookingType[]; staff: StaffOption[]; people: { id: string; name: string; email: string | null; phone: string | null }[];
  timezone: string; readOnly: boolean; onClose: () => void;
}) {
  const start0 = booking ? localParts(booking.starts_at, timezone) : { date: new Date().toLocaleDateString("en-CA"), time: "10:00" };
  const [f, setF] = useState({
    type_id: booking?.type_id ?? types[0]?.id ?? "", date: start0.date, time: start0.time,
    minutes: booking ? Math.round((Date.parse(booking.ends_at) - Date.parse(booking.starts_at)) / 60000) : types[0]?.minutes ?? 30,
    status: booking?.status ?? "confirmed", name: booking?.name ?? "", email: booking?.email ?? "", phone: booking?.phone ?? "",
    company: booking?.company ?? "", notes: booking?.notes ?? "", location: booking?.location ?? "", host_id: booking?.host_id ?? "", contact_id: booking?.contact_id ?? "",
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={booking ? booking.title : "New booking"} className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bk-contact">Contact</Label>
            <select id="bk-contact" className={SELECT} value={f.contact_id} disabled={readOnly} onChange={(e) => {
              const p = people.find((x) => x.id === e.target.value);
              set({ contact_id: e.target.value, ...(p ? { name: p.name, email: p.email ?? f.email, phone: p.phone ?? f.phone } : {}) });
            }}>
              <option value="">Not in the CRM / type below</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bk-name">Name</Label><Input id="bk-name" value={f.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-email">Email</Label><Input id="bk-email" type="email" value={f.email} disabled={readOnly} onChange={(e) => set({ email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-type">Type</Label>
            <select id="bk-type" className={SELECT} value={f.type_id} disabled={readOnly} onChange={(e) => { const t = types.find((x) => x.id === e.target.value); set({ type_id: e.target.value, minutes: t?.minutes ?? f.minutes }); }}>
              <option value="">Other meeting</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bk-status">Status</Label>
            <select id="bk-status" className={SELECT} value={f.status} disabled={readOnly} onChange={(e) => set({ status: e.target.value as BookingStatus })}>
              {BOOKING_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Date</Label><DatePicker value={f.date} onChange={(v) => set({ date: v })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label htmlFor="bk-time">Time</Label><TimePicker id="bk-time" value={f.time} disabled={readOnly} step={15} onChange={(v) => set({ time: v })} /></div>
            <div className="space-y-1.5"><Label htmlFor="bk-min">Minutes</Label><Input id="bk-min" type="number" min={5} value={f.minutes} disabled={readOnly} onChange={(e) => set({ minutes: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bk-phone">Phone</Label><PhoneInput id="bk-phone" value={f.phone} disabled={readOnly} onChange={(v) => set({ phone: v })} /></div>
          <div className="space-y-1.5"><Label htmlFor="bk-host">Host</Label>
            <select id="bk-host" className={SELECT} value={f.host_id} disabled={readOnly} onChange={(e) => set({ host_id: e.target.value })}>
              <option value="">Anyone</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bk-loc">Location or link</Label><Input id="bk-loc" value={f.location} disabled={readOnly} onChange={(e) => set({ location: e.target.value })} placeholder="Zoom link, address, or phone" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bk-notes">Notes</Label><Textarea id="bk-notes" rows={3} value={f.notes} disabled={readOnly} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Times are in {timezone.replace("_", " ")}.{booking?.source === "website" ? " Booked on the website." : ""}{booking?.reminder_sent_at ? " Reminder sent." : ""}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
            {booking && booking.status !== "canceled" && <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await setBookingStatus([booking.id], "canceled"); if (r.error) setError(r.error); else onClose(); })}><X /> Cancel booking</Button>}
            {booking && booking.status !== "no_show" && <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await setBookingStatus([booking.id], "no_show"); if (r.error) setError(r.error); else onClose(); })}><UserX /> No-show</Button>}
            <Button disabled={pending} onClick={() => start(async () => {
              const r = await saveBooking(booking?.id ?? null, { ...f, timezone, contact_id: f.contact_id || null, host_id: f.host_id || null, type_id: f.type_id || null });
              if (r.error) setError(r.error); else onClose();
            })}>{pending ? "Saving…" : booking ? "Save" : "Book"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
