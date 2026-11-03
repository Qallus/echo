// Summary visuals (mind map, list, bars, timeline, kanban, pie, table) and the
// dates a recording mentions. Client-safe.

export type VisualKind = "mindmap" | "list" | "bars" | "timeline" | "kanban" | "pie" | "table";
export type ItemStatus = "idea" | "planned" | "in_progress" | "blocked" | "done";
export type VisualItem = { label: string; group: string; status: ItemStatus; weight: number; start?: string | null; end?: string | null };
export type MentionedDate = {
  kind: "appointment" | "event" | "deadline"; title: string; date: string; endDate?: string | null;
  start?: string | null; end?: string | null; allDay: boolean; location?: string | null; people: string[]; quote?: string | null;
};

export const VISUALS: { id: VisualKind; label: string }[] = [
  { id: "mindmap", label: "Mind map" }, { id: "list", label: "List" }, { id: "bars", label: "Bar chart" }, { id: "timeline", label: "Timeline" },
  { id: "kanban", label: "Kanban" }, { id: "pie", label: "Pie chart" }, { id: "table", label: "Table" },
];
export const STATUS_LABEL: Record<ItemStatus, string> = { idea: "Idea", planned: "Planned", in_progress: "In progress", blocked: "Blocked", done: "Done" };
export const isVisual = (v: unknown): v is VisualKind => VISUALS.some((x) => x.id === v);

const STATUSES: ItemStatus[] = ["idea", "planned", "in_progress", "blocked", "done"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export function readItems(v: unknown): VisualItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((i) => i && typeof i.label === "string").slice(0, 20).map((i) => ({
    label: String(i.label).slice(0, 80), group: String(i.group ?? "General").slice(0, 40),
    status: STATUSES.includes(i.status) ? i.status : "idea", weight: Math.max(1, Math.min(100, Math.round(Number(i.weight) || 50))),
    start: DAY.test(i.start) ? i.start : null, end: DAY.test(i.end) ? i.end : null,
  }));
}

export function readDates(v: unknown): MentionedDate[] {
  if (!Array.isArray(v)) return [];
  return v.filter((d) => d && typeof d.title === "string" && DAY.test(d.date)).slice(0, 20).map((d) => ({
    kind: ["appointment", "event", "deadline"].includes(d.kind) ? d.kind : "appointment", title: String(d.title).slice(0, 200), date: d.date,
    endDate: DAY.test(d.endDate) ? d.endDate : null, start: TIME.test(d.start) ? d.start : null, end: TIME.test(d.end) ? d.end : null,
    allDay: Boolean(d.allDay) || !TIME.test(d.start), location: typeof d.location === "string" ? d.location.slice(0, 300) : null,
    people: Array.isArray(d.people) ? d.people.filter((p: unknown) => typeof p === "string").slice(0, 20) : [], quote: typeof d.quote === "string" ? d.quote.slice(0, 500) : null,
  }));
}

// Older summaries have no items: build them from the mind map branches and action items.
export function itemsFor(items: VisualItem[], branches: string[], actions: { text: string; done: boolean; owner: string }[]): VisualItem[] {
  if (items.length) return items;
  const fromBranches = branches.map((b, i) => ({ label: b, group: "Topics", status: "idea" as const, weight: Math.max(30, 90 - i * 10) }));
  const fromActions = actions.slice(0, 8).map((a) => ({ label: a.text.slice(0, 80), group: a.owner, status: a.done ? "done" as const : "planned" as const, weight: 60 }));
  return [...fromBranches, ...fromActions];
}
