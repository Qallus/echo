// The internal CRM (Super Admin S5a). Stages, statuses and kinds mirror the
// check constraints in supabase/migrations/20261102140000_crm_core.sql.

export const DEAL_STAGES = [
  { id: "lead", label: "Lead", dot: "bg-slate-400" },
  { id: "contacted", label: "Contacted", dot: "bg-sky-500" },
  { id: "qualified", label: "Qualified", dot: "bg-indigo-500" },
  { id: "demo", label: "Demo", dot: "bg-violet-500" },
  { id: "proposal", label: "Proposal", dot: "bg-amber-500" },
  { id: "won", label: "Won", dot: "bg-emerald-500" },
  { id: "lost", label: "Lost", dot: "bg-rose-500" },
] as const;
export type DealStage = (typeof DEAL_STAGES)[number]["id"];
export const OPEN_STAGES: DealStage[] = ["lead", "contacted", "qualified", "demo", "proposal"];
export const isStage = (v: unknown): v is DealStage => DEAL_STAGES.some((s) => s.id === v);
export const stageOf = (id: DealStage) => DEAL_STAGES.find((s) => s.id === id)!;

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
  { id: "meeting", label: "Meeting" },
  { id: "task", label: "Task" },
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["id"];
export const isActivityKind = (v: unknown): v is ActivityKind => ACTIVITY_KINDS.some((k) => k.id === v);

export type StaffOption = { user_id: string; name: string; email: string };

export type Company = {
  id: string; name: string; status: CompanyStatus; website: string | null; industry: string | null; phone: string | null;
  email: string | null; address: string | null; notes: string | null; tags: string[]; owner_id: string | null;
  created_at: string; updated_at: string;
};

export type Contact = {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; title: string | null;
  company_id: string | null; source: string | null; notes: string | null; tags: string[]; owner_id: string | null;
  created_at: string; updated_at: string;
  company?: { id: string; name: string } | null;
};

export type Deal = {
  id: string; title: string; stage: DealStage; value_cents: number; currency: string; company_id: string | null; contact_id: string | null;
  expected_close: string | null; next_step: string | null; next_step_due: string | null; source: string | null; lost_reason: string | null;
  notes: string | null; owner_id: string | null; closed_at: string | null; created_at: string; updated_at: string;
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null } | null;
};

export type Activity = {
  id: string; kind: ActivityKind; body: string; due_at: string | null; done_at: string | null;
  company_id: string | null; contact_id: string | null; deal_id: string | null; created_by: string | null; created_at: string;
};

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

// Won or lost within the last 30 days (older closed deals leave the board).
export const closedRecently = (closedAt: string | null) => !closedAt || Date.now() - Date.parse(closedAt) < 30 * 86400_000;
