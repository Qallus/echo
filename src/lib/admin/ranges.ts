// Date ranges for Analytics and Reports, counted in the organization's time
// zone. Dates are "YYYY-MM-DD".

export const RANGES = [
  { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" }, { id: "ytd", label: "Year to date" },
] as const;
export type RangeId = (typeof RANGES)[number]["id"] | "custom";

export const isRange = (v: string | undefined): v is RangeId => v === "custom" || RANGES.some((r) => r.id === v);

export function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const shift = (day: string, days: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function rangeDates(range: RangeId, tz: string, custom?: { since?: string; until?: string }) {
  const until = todayIn(tz);
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  if (range === "custom" && valid(custom?.since) && valid(custom?.until) && custom!.since! <= custom!.until!) {
    return { since: custom!.since!, until: custom!.until!, by: bucketFor(custom!.since!, custom!.until!) };
  }
  const since = range === "7d" ? shift(until, -6) : range === "90d" ? shift(until, -89) : range === "12m" ? `${shift(until, -365).slice(0, 7)}-01`
    : range === "ytd" ? `${until.slice(0, 4)}-01-01` : shift(until, -29);
  return { since, until, by: bucketFor(since, until) };
}

export function bucketFor(since: string, until: string): "day" | "week" | "month" {
  const days = (Date.parse(until) - Date.parse(since)) / 86400_000;
  return days <= 62 ? "day" : days <= 180 ? "week" : "month";
}
