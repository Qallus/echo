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
  equipment: string[];
  workspace: string[];
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

export type Filters = { q: string; skill: string; language: string; rate: RateRangeId; setup: string; now: boolean; sort: SortId; view: "grid" | "list" | "map" };

// Equipment and workspace: what businesses check before trusting someone
// with their callers. Slugs are stored on the profile; icons are lucide names.
export type Attribute = { slug: string; label: string; icon: string; group: string };
export const EQUIPMENT: Attribute[] = [
  { slug: "desktop", label: "Desktop computer", icon: "pc-case", group: "Computer" },
  { slug: "laptop", label: "Laptop", icon: "laptop", group: "Computer" },
  { slug: "tablet", label: "Tablet", icon: "tablet", group: "Computer" },
  { slug: "second-monitor", label: "Second monitor", icon: "monitor", group: "Computer" },
  { slug: "usb-headset", label: "Headset with microphone", icon: "headset", group: "Audio and video" },
  { slug: "noise-cancelling", label: "Noise-cancelling headset", icon: "headphones", group: "Audio and video" },
  { slug: "webcam", label: "Webcam", icon: "webcam", group: "Audio and video" },
  { slug: "smartphone", label: "Smartphone", icon: "smartphone", group: "Phones" },
  { slug: "landline", label: "Landline or desk phone", icon: "phone", group: "Phones" },
  { slug: "wired-internet", label: "Wired (Ethernet) internet", icon: "cable", group: "Reliability" },
  { slug: "backup-internet", label: "Backup internet or hotspot", icon: "wifi", group: "Reliability" },
  { slug: "backup-power", label: "Battery backup (UPS)", icon: "battery-charging", group: "Reliability" },
];
export const WORKSPACE: Attribute[] = [
  { slug: "home-office", label: "Home office", icon: "house", group: "Where" },
  { slug: "coworking", label: "Coworking or office space", icon: "building-2", group: "Where" },
  { slug: "shared-space", label: "Shared space at home", icon: "users", group: "Where" },
  { slug: "door-closes", label: "Enclosed room with a door", icon: "door-closed", group: "Privacy" },
  { slug: "dedicated-desk", label: "Dedicated desk", icon: "lamp-desk", group: "Privacy" },
  { slug: "quiet", label: "Quiet, no background noise", icon: "volume-x", group: "Privacy" },
  { slug: "video-ready", label: "Professional video backdrop", icon: "webcam", group: "Privacy" },
];
export const ATTRIBUTES = [...EQUIPMENT, ...WORKSPACE];
// The ones offered as browse filters.
export const SETUP_FILTERS = ["usb-headset", "noise-cancelling", "door-closes", "dedicated-desk", "quiet", "webcam", "wired-internet", "backup-internet", "backup-power", "desktop", "landline"];

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 80) : "");
  const sort = SORTS.some((s) => s.id === one("sort")) ? (one("sort") as SortId) : "best";
  const rate = RATE_RANGES.some((r) => r.id === one("rate")) ? (one("rate") as RateRangeId) : "any";
  const view = one("view") === "list" || one("view") === "map" ? (one("view") as "list" | "map") : "grid";
  const setup = ATTRIBUTES.some((a) => a.slug === one("setup")) ? one("setup") : "";
  return { q: one("q").trim(), skill: one("skill"), language: one("language"), rate, setup, now: one("now") === "1", sort, view };
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
