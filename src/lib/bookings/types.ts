// Bookings (Super Admin batch B). Mirrors supabase/migrations/20261103140000_bookings_plans.sql.

export const BOOKING_STATUSES = [
  { id: "pending", label: "Pending", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "confirmed", label: "Confirmed", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { id: "completed", label: "Completed", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "canceled", label: "Canceled", tone: "bg-muted text-muted-foreground" },
  { id: "no_show", label: "No-show", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number]["id"];
export const isBookingStatus = (v: unknown): v is BookingStatus => BOOKING_STATUSES.some((s) => s.id === v);

export const LOCATIONS = [
  { id: "video", label: "Video call" }, { id: "phone", label: "Phone call" }, { id: "in_person", label: "In person" },
] as const;
export type LocationKind = (typeof LOCATIONS)[number]["id"];

export type BookingType = {
  id: string; name: string; slug: string; description: string | null; minutes: number; location: LocationKind; location_detail: string | null;
  buffer_minutes: number; min_notice_hours: number; max_days_ahead: number; host_id: string | null; color: string; active: boolean; sort: number;
};

export type Booking = {
  id: string; type_id: string | null; title: string; starts_at: string; ends_at: string; status: BookingStatus; name: string; email: string | null;
  phone: string | null; company: string | null; notes: string | null; location: string | null; source: "website" | "dashboard"; host_id: string | null;
  contact_id: string | null; company_id: string | null; deal_id: string | null; reminder_sent_at: string | null; created_at: string;
};

// Weekly hours by ISO weekday ("1" = Monday … "7" = Sunday), time zone, days off.
export type Availability = { timezone: string; days: Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", [string, string]>>; blackout: string[] };
export const DEFAULT_AVAILABILITY: Availability = {
  timezone: "America/Phoenix",
  days: { 1: ["09:00", "16:00"], 2: ["09:00", "16:00"], 3: ["09:00", "16:00"], 4: ["09:00", "16:00"], 5: ["09:00", "16:00"] },
  blackout: [],
};
export const WEEKDAYS = [["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["7", "Sunday"]] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export function parseAvailability(raw: unknown): Availability {
  const r = (raw ?? {}) as Partial<Availability>;
  const days: Availability["days"] = {};
  for (const [d] of WEEKDAYS) {
    const v = r.days?.[d];
    if (Array.isArray(v) && v.length === 2 && TIME.test(v[0]) && TIME.test(v[1]) && v[0] < v[1]) days[d] = [v[0], v[1]];
  }
  return {
    timezone: typeof r.timezone === "string" && /^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(r.timezone) ? r.timezone : DEFAULT_AVAILABILITY.timezone,
    days, blackout: Array.isArray(r.blackout) ? r.blackout.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 200) : [],
  };
}

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function formatWhen(iso: string, tz?: string) {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) });
}
