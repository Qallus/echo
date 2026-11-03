// Events (bookings batch). Mirrors supabase/migrations/20261103150000_events.sql.

export const EVENT_STATUSES = [
  { id: "draft", label: "Draft", tone: "bg-muted text-muted-foreground" },
  { id: "published", label: "Published", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "canceled", label: "Canceled", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number]["id"];

export const EVENT_LOCATIONS = [
  { id: "in_person", label: "In person" }, { id: "online", label: "Online" }, { id: "hybrid", label: "In person and online" },
] as const;
export type EventLocation = (typeof EVENT_LOCATIONS)[number]["id"];

export type EventRow = {
  id: string; title: string; slug: string; summary: string | null; description: string | null; location_kind: EventLocation; location: string | null;
  online_url: string | null; starts_at: string; ends_at: string; all_day: boolean; capacity: number | null; status: EventStatus; registration_open: boolean;
  host_id: string | null; created_at: string;
};
export type Registration = {
  id: string; event_id: string; name: string; email: string; phone: string | null; company: string | null; guests: number;
  status: "registered" | "canceled" | "attended" | "no_show"; contact_id: string | null; created_at: string;
};
export type PublicEvent = {
  title: string; slug: string; summary: string | null; description: string | null; location_kind: EventLocation; location: string | null;
  starts_at: string; ends_at: string; all_day: boolean; capacity: number | null; spots_left: number | null; registration_open: boolean; timezone: string;
};

// "Sat, Nov 14 · 9:00 AM – 1:00 PM", "Nov 14 – 16", or an all-day date.
export function eventWhen(e: { starts_at: string; ends_at: string; all_day: boolean }, tz: string) {
  const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, ...opts });
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const sameDay = day(e.starts_at, { dateStyle: "short" }) === day(new Date(Date.parse(e.ends_at) - 1).toISOString(), { dateStyle: "short" });
  if (sameDay) return `${day(e.starts_at, { weekday: "short", month: "short", day: "numeric" })}${e.all_day ? " · All day" : ` · ${time(e.starts_at)} – ${time(e.ends_at)}`}`;
  return e.all_day
    ? `${day(e.starts_at, { month: "short", day: "numeric" })} – ${day(new Date(Date.parse(e.ends_at) - 1).toISOString(), { month: "short", day: "numeric", year: "numeric" })}`
    : `${day(e.starts_at, { month: "short", day: "numeric" })}, ${time(e.starts_at)} – ${day(e.ends_at, { month: "short", day: "numeric" })}, ${time(e.ends_at)}`;
}
