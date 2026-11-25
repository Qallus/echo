// The Home dashboard's layout: sections (rows that slide sideways, or grids)
// holding cards. Saved per person (user_dashboards), shared by the page and
// the save action. Unknown card types are dropped when a layout is read.

export const CARD_TYPES = [
  // Info
  "get_started", "setup_progress", "whats_new", "install_app",
  // Tools
  "search", "all_features", "clock", "weather", "dialpad", "recorder", "notepad", "ask_echo", "quick_links",
  // Lists
  "notifications", "next_up", "live_call", "recent_calls", "recent_texts", "recent_files", "my_agents",
  // Schedule
  "mini_calendar", "upcoming",
  // Stats
  "stat_calls", "stat_outbound", "stat_inbound", "stat_missed", "stat_monitored", "stat_recordings", "stat_sms", "stat_bookings",
  "stat_calendar", "stat_notifications", "stat_messages", "stat_alerts", "stat_emails", "stat_files",
  // Charts
  "chart_calls", "chart_texts", "chart_recordings", "chart_outcomes",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
export type Size = (typeof SIZES)[number];

export type Card = { id: string; type: CardType; size: Size; hidden?: boolean; settings?: Record<string, unknown> };
export type Section = { id: string; title: string; hidden?: boolean; collapsed?: boolean; style: "row" | "grid"; cards: Card[] };
export type Layout = { v: 1; template: "standard" | "blank"; sections: Section[] };

let n = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const card = (type: CardType, size: Size, settings?: Record<string, unknown>): Card => ({ id: `${type}-1`, type, size, ...(settings ? { settings } : {}) });

export const STANDARD: Layout = {
  v: 1, template: "standard", sections: [
    { id: "start", title: "Get started", style: "row", cards: [card("setup_progress", "lg"), card("get_started", "xl")] },
    { id: "status", title: "Search and status", style: "row", cards: [card("search", "lg"), card("all_features", "xs"), card("clock", "sm"), card("weather", "sm")] },
    { id: "activity", title: "Activity", style: "row", cards: [card("notifications", "md"), card("next_up", "md"), card("live_call", "md")] },
    { id: "stats", title: "Stats", style: "row", cards: [
      card("stat_calls", "sm"), card("stat_outbound", "xs"), card("stat_inbound", "xs"), card("stat_missed", "xs"), card("stat_monitored", "xs"),
      card("stat_recordings", "xs"), card("stat_sms", "sm"), card("stat_bookings", "xs"), card("stat_calendar", "xs"), card("stat_notifications", "xs"),
      card("stat_messages", "xs"), card("stat_alerts", "xs"), card("stat_emails", "xs"), card("stat_files", "sm"),
    ] },
    { id: "files", title: "Recent files", style: "row", cards: [card("recent_files", "xl")] },
    { id: "news", title: "What's new", style: "row", cards: [card("whats_new", "xl")] },
  ],
};

export const BLANK: Layout = {
  v: 1, template: "blank", sections: [
    { id: "start", title: "Get started", style: "row", cards: [card("get_started", "xl")] },
    { id: "mine", title: "My dashboard", style: "grid", cards: [] },
  ],
};

const isType = (t: unknown): t is CardType => (CARD_TYPES as readonly string[]).includes(t as string);
const isSize = (s: unknown): s is Size => (SIZES as readonly string[]).includes(s as string);
const text = (v: unknown, d: string, max = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);

/** A clean layout from anything saved (or null for "never set up"). */
export function normalize(value: unknown): Layout | null {
  const v = value as Partial<Layout> | null;
  if (!v || !Array.isArray(v.sections)) return null;
  const seen = new Set<string>();
  const sections: Section[] = v.sections.slice(0, 40).flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const id = text(s.id, newId("s"), 80);
    if (seen.has(id)) return [];
    seen.add(id);
    const cards: Card[] = (Array.isArray(s.cards) ? s.cards : []).slice(0, 60).flatMap((c) => {
      if (!c || !isType(c.type)) return [];
      const cid = text(c.id, newId(c.type), 80);
      if (seen.has(cid)) return [];
      seen.add(cid);
      const settings = c.settings && typeof c.settings === "object" && !Array.isArray(c.settings) ? c.settings : undefined;
      return [{ id: cid, type: c.type, size: isSize(c.size) ? c.size : "sm", ...(c.hidden ? { hidden: true } : {}), ...(settings ? { settings } : {}) }];
    });
    return [{ id, title: text(s.title, "Section"), style: s.style === "grid" ? "grid" : "row", cards,
      ...(s.hidden ? { hidden: true } : {}), ...(s.collapsed ? { collapsed: true } : {}) }];
  });
  return { v: 1, template: v.template === "blank" ? "blank" : "standard", sections };
}

export const copy = (l: Layout): Layout => JSON.parse(JSON.stringify(l)) as Layout;
