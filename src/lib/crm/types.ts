// The internal CRM. Stages, roles, statuses and kinds mirror the check
// constraints in supabase/migrations/20261102140000_crm_core.sql and
// 20261103090000_crm_v2.sql. The stage model itself lives in ./deals.

import { STAGES, STAGE_ORDER, isStage as isDealStage, type CustomField, type DealStage, type ExtraStep, type NextStepType } from "./deals";

export { OPEN_STAGES, type DealStage } from "./deals";
export const DEAL_STAGES = STAGE_ORDER.map((id) => ({ id, label: STAGES[id].label, dot: STAGES[id].dot }));
export const isStage = isDealStage;
export const stageOf = (id: DealStage) => ({ id, ...STAGES[id] });

export const CONTACT_ROLES = [
  { id: "contact", label: "Contact", tone: "bg-secondary text-secondary-foreground" },
  { id: "lead", label: "Lead", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "prospect", label: "Prospect", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { id: "client", label: "Client", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "partner", label: "Partner", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number]["id"];
export const isContactRole = (v: unknown): v is ContactRole => CONTACT_ROLES.some((r) => r.id === v);

export const CONTACT_STATUSES = [
  { id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }, { id: "archived", label: "Archived" },
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number]["id"];
export const isContactStatus = (v: unknown): v is ContactStatus => CONTACT_STATUSES.some((r) => r.id === v);

export const LEAD_STATUSES = [
  { id: "new", label: "New", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300", open: true },
  { id: "attempting", label: "Attempting contact", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", open: true },
  { id: "contacted", label: "Contacted", tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", open: true },
  { id: "nurture", label: "Nurture", tone: "bg-secondary text-secondary-foreground", open: true },
  { id: "qualified", label: "Qualified", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300", open: true },
  { id: "in_pipeline", label: "In pipeline", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", open: false },
  { id: "disqualified", label: "Disqualified", tone: "bg-muted text-muted-foreground", open: false },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];
export const isLeadStatus = (v: unknown): v is LeadStatus => LEAD_STATUSES.some((r) => r.id === v);

export const COMPANY_STATUSES = [
  { id: "prospect", label: "Prospect" },
  { id: "client", label: "Client" },
  { id: "partner", label: "Partner" },
  { id: "former", label: "Former client" },
] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]["id"];
export const isCompanyStatus = (v: unknown): v is CompanyStatus => COMPANY_STATUSES.some((s) => s.id === v);

export const ACTIVITY_KINDS = [
  { id: "note", label: "Note" },
  { id: "call", label: "Call" },
  { id: "email", label: "Email" },
  { id: "sms", label: "Text" },
  { id: "meeting", label: "Meeting" },
  { id: "task", label: "Task" },
  { id: "voicemail", label: "Voicemail" },
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["id"];
export const isActivityKind = (v: unknown): v is ActivityKind => ACTIVITY_KINDS.some((k) => k.id === v);

export type StaffOption = { user_id: string; name: string; email: string };

export type Company = {
  id: string; name: string; status: CompanyStatus; website: string | null; industry: string | null; phone: string | null;
  email: string | null; address: string | null; notes: string | null; tags: string[]; owner_id: string | null;
  latitude: number | null; longitude: number | null; geocoded_address: string | null;
  created_at: string; updated_at: string;
};

export type Contact = {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; title: string | null;
  company_id: string | null; source: string | null; notes: string | null; tags: string[]; owner_id: string | null;
  role: ContactRole; status: ContactStatus; lead_status: LeadStatus | null; interest: string | null; website: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null; details: Record<string, string>;
  created_at: string; updated_at: string;
  company?: { id: string; name: string } | null;
};

export type Deal = {
  id: string; title: string; stage: DealStage; value_cents: number; currency: string; company_id: string | null; contact_id: string | null;
  expected_close: string | null; next_step: string | null; next_step_due: string | null; source: string | null; lost_reason: string | null;
  notes: string | null; owner_id: string | null; closed_at: string | null; created_at: string; updated_at: string;
  probability: number; opportunity_type: string | null; products: string[]; next_step_type: NextStepType | null;
  next_step_priority: "low" | "normal" | "high"; stage_entered_at: string; checklist: Record<string, boolean>;
  extra_steps: ExtraStep[]; custom_fields: CustomField[]; won_summary: string | null; lost_notes: string | null; competitor: string | null;
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null } | null;
};

export type Activity = {
  id: string; kind: ActivityKind; body: string; due_at: string | null; done_at: string | null;
  company_id: string | null; contact_id: string | null; deal_id: string | null; created_by: string | null; created_at: string;
  direction: "inbound" | "outbound" | null; subject: string | null; from_addr: string | null; to_addr: string | null;
  status: string | null; duration_seconds: number | null; recording_path: string | null; transcript: string | null;
  ai_summary: string | null; occurred_at: string;
};

export type DealHistory = { id: number; deal_id: string; kind: "stage" | "owner"; stage: DealStage | null; owner_id: string | null; actor: string | null; created_at: string };

export const ownerName = (staff: StaffOption[], id: string | null) => (id ? staff.find((s) => s.user_id === id)?.name ?? "Former staff" : null);

export const contactName = (c: { first_name: string; last_name: string | null }) => [c.first_name, c.last_name].filter(Boolean).join(" ");

// "YYYY-MM-DD" for today in the server's or browser's local time.
export const today = () => new Date().toLocaleDateString("en-CA");

// A next step or task that's past due.
export const isOverdue = (date: string | null) => Boolean(date && date.slice(0, 10) < today());

// "Nov 5" (or "Nov 5, 2027" outside this year) for a YYYY-MM-DD date, with
// no time-zone shift.
export function formatDay(d: string) {
  const date = new Date(`${d.slice(0, 10)}T12:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

// Closed within the last 30 days (older closed deals leave the board).
export const closedRecently = (closedAt: string | null) => !closedAt || Date.now() - Date.parse(closedAt) < 30 * 86400_000;
