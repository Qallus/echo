// The pipeline model, from Channel-Cast's lib/crm/deals.ts. Stage keys mirror
// the check constraint in supabase/migrations/20261103090000_crm_v2.sql.

export const STAGES = {
  new_working: { label: "New / Working", tone: "bg-muted text-muted-foreground", dot: "bg-slate-400", prob: 10 },
  contacted: { label: "Contacted", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300", dot: "bg-sky-500", prob: 20 },
  qualified: { label: "Qualified", tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", prob: 35 },
  opportunity: { label: "Opportunity", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300", dot: "bg-violet-500", prob: 50 },
  proposal: { label: "Proposal", tone: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500", prob: 65 },
  negotiation: { label: "Negotiation", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", prob: 80 },
  closed_won: { label: "Closed Won", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", prob: 100 },
  closed_lost: { label: "Closed Lost", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300", dot: "bg-rose-500", prob: 0 },
  nurture: { label: "Nurture", tone: "bg-secondary text-secondary-foreground", dot: "bg-teal-500", prob: 10 },
} as const;

export type DealStage = keyof typeof STAGES;

/** The forward path. Closed Lost is an outcome from any stage, not a column to walk to. */
export const PIPELINE_PATH: DealStage[] = ["new_working", "contacted", "qualified", "opportunity", "proposal", "negotiation", "closed_won"];
export const STAGE_ORDER: DealStage[] = [...PIPELINE_PATH, "closed_lost", "nurture"];
/** Counts toward open pipeline and the forecast. */
export const OPEN_STAGES: DealStage[] = ["new_working", "contacted", "qualified", "opportunity", "proposal", "negotiation"];
export const isStage = (v: unknown): v is DealStage => typeof v === "string" && v in STAGES;
export const isClosed = (s: DealStage) => s === "closed_won" || s === "closed_lost";

export const OPPORTUNITY_TYPES = [
  "New subscription", "Business plan", "Team expansion", "Add-on", "Minute packs", "Partner", "Reseller",
  "Enterprise", "Integration", "Services", "Other",
];

export const LOST_REASONS = [
  "Price", "No budget", "Timing", "No response", "Competitor", "Chose another solution",
  "Not a fit", "Internal approval denied", "Project canceled", "Duplicate", "Invalid lead", "Other",
];

export const NEXT_STEP_TYPES = [
  { key: "call", label: "Call" }, { key: "email", label: "Email" }, { key: "sms", label: "Text" },
  { key: "meeting", label: "Meeting" }, { key: "demo", label: "Demo" }, { key: "proposal", label: "Proposal" },
  { key: "follow_up", label: "Follow-up" }, { key: "contract", label: "Contract" }, { key: "other", label: "Other" },
] as const;
export type NextStepType = (typeof NEXT_STEP_TYPES)[number]["key"];
export const isNextStepType = (v: unknown): v is NextStepType => NEXT_STEP_TYPES.some((t) => t.key === v);

export type CustomFieldType = "text" | "number" | "date";
export type CustomField = { id: string; label: string; type: CustomFieldType; value: string };
/** A Next Step added to one deal on top of its stage template. */
export type ExtraStep = { id: string; label: string; stage: DealStage; required?: boolean };

const DAY = 86_400_000;
export const daysSince = (iso: string, until?: string | null) =>
  Math.max(0, Math.floor(((until ? Date.parse(until) : Date.now()) - Date.parse(iso)) / DAY));

export const weighted = (d: { value_cents: number; probability: number }) => Math.round(d.value_cents * (d.probability / 100));

/** No future next step on an open deal is the thing to flag. */
export function needsNextStep(d: { stage: DealStage; next_step_due: string | null }) {
  if (isClosed(d.stage) || d.stage === "nurture") return false;
  return !d.next_step_due || d.next_step_due < new Date().toLocaleDateString("en-CA");
}

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
