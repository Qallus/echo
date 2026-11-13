// Redial Live Agents: real people who take the calls a business's Redial AI
// hands to them. Shared types, filters and pricing helpers (client + server).

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: { key: Weekday; short: string }[] = [
  { key: "mon", short: "Mon" }, { key: "tue", short: "Tue" }, { key: "wed", short: "Wed" }, { key: "thu", short: "Thu" },
  { key: "fri", short: "Fri" }, { key: "sat", short: "Sat" }, { key: "sun", short: "Sun" },
];

export type Skill = { slug: string; label: string; icon: string; category: string };
export type VoiceSample = { id: string; title: string; transcript: string | null; url: string; durationS: number | null; featured: boolean; aiVoice: boolean };

export type LiveAgent = {
  id: string;
  handle: string;
  displayName: string;
  headline: string;
  bio: string | null;
  city: string;
  region: string;
  timeZone: string;
  lat: number | null;
  lng: number | null;
  yearsExperience: number;
  languages: string[];
  industries: string[];
  skills: string[];
  experience: { title: string; detail?: string }[];
  perMinuteCents: number | null;
  hourlyCents: number | null;
  retainerCents: number | null;
  retainerHours: number | null;
  availability: Partial<Record<Weekday, [string, string]>>;
  availableNow: boolean;
  avatarUrl: string | null;
  isDemo: boolean;
  indexable: boolean;
  rating: number | null;
  reviewCount: number;
  engagementCount: number;
  replyMinutes: number | null;
  badges: string[];
  samples: VoiceSample[];
};

export type Fees = { businessFeePercent: number; agentFeePercent: number };
export const DEFAULT_FEES: Fees = { businessFeePercent: 10, agentFeePercent: 15 };

// What the business pays and what the agent receives for a rate.
export function feeSplit(rateCents: number, fees: Fees) {
  const business = Math.round(rateCents * (1 + fees.businessFeePercent / 100));
  const agent = Math.round(rateCents * (1 - fees.agentFeePercent / 100));
  return { business, agent, platform: business - agent };
}

export function money(cents: number, { exact = false }: { exact?: boolean } = {}) {
  const whole = cents % 100 === 0 && !exact;
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// Browse filters, kept in the URL so results are shareable.
export const SORTS = [
  { id: "best", label: "Best match" },
  { id: "price", label: "Price: low to high" },
  { id: "experience", label: "Most experience" },
  { id: "replies", label: "Fastest replies" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

export const RATE_RANGES = [
  { id: "any", label: "Any hourly rate" },
  { id: "u25", label: "Under $25/hr", max: 2500 },
  { id: "25-30", label: "$25–$30/hr", min: 2500, max: 3000 },
  { id: "30-35", label: "$30–$35/hr", min: 3000, max: 3500 },
  { id: "35p", label: "$35+/hr", min: 3500 },
] as const;
export type RateRangeId = (typeof RATE_RANGES)[number]["id"];

export type Filters = { q: string; skill: string; language: string; rate: RateRangeId; now: boolean; sort: SortId; view: "grid" | "list" | "map" };

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 80) : "");
  const sort = SORTS.some((s) => s.id === one("sort")) ? (one("sort") as SortId) : "best";
  const rate = RATE_RANGES.some((r) => r.id === one("rate")) ? (one("rate") as RateRangeId) : "any";
  const view = one("view") === "list" || one("view") === "map" ? (one("view") as "list" | "map") : "grid";
  return { q: one("q").trim(), skill: one("skill"), language: one("language"), rate, now: one("now") === "1", sort, view };
}

// Badges Redial computes (never self-claimed).
export const BADGES: Record<string, { label: string; icon: string }> = {
  "id-verified": { label: "ID verified", icon: "badge-check" },
  "background-checked": { label: "Background checked", icon: "shield-check" },
  "fast-responder": { label: "Fast responder", icon: "zap" },
  "top-rated": { label: "Top rated", icon: "star" },
  certified: { label: "Redial certified", icon: "sparkles" },
};

export const firstName = (displayName: string) => displayName.split(" ")[0];

export function replyLabel(minutes: number | null) {
  if (minutes == null) return null;
  if (minutes < 60) return `Replies in about ${minutes} min`;
  const h = Math.round(minutes / 60);
  return `Replies in about ${h} hour${h === 1 ? "" : "s"}`;
}

export const tzLabel = (tz: string) =>
  ({ "America/Phoenix": "Arizona time", "America/Los_Angeles": "Pacific time", "America/Denver": "Mountain time", "America/Chicago": "Central time", "America/New_York": "Eastern time" })[tz] ?? tz;
