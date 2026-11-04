import type { Permission } from "./permissions";

// The reports in Admin -> Reports. Each is one public.admin_report(kind)
// call (supabase/migrations/20261104110000_batch_d.sql); columns say how to
// show and export each field.

export type ColumnFormat = "text" | "count" | "money" | "percent" | "stage" | "days";
export type Column = { key: string; label: string; format: ColumnFormat };
export type ReportDef = { kind: string; title: string; description: string; needs: Permission; columns: Column[] };

export const REPORTS: ReportDef[] = [
  { kind: "pipeline_by_stage", title: "Pipeline by stage", needs: "crm.view", description: "Deals added in the period, by the stage they're in now.",
    columns: [{ key: "stage", label: "Stage", format: "stage" }, { key: "deals", label: "Deals", format: "count" }, { key: "value_cents", label: "Value", format: "money" },
      { key: "weighted_cents", label: "Weighted", format: "money" }, { key: "avg_days_in_stage", label: "Avg. days in stage", format: "days" }] },
  { kind: "pipeline_by_owner", title: "Pipeline by owner", needs: "crm.view", description: "Open, won and lost deals per owner, for deals added in the period.",
    columns: [{ key: "owner", label: "Owner", format: "text" }, { key: "open", label: "Open", format: "count" }, { key: "open_value_cents", label: "Open value", format: "money" },
      { key: "won", label: "Won", format: "count" }, { key: "won_value_cents", label: "Won value", format: "money" }, { key: "lost", label: "Lost", format: "count" }, { key: "win_rate", label: "Win rate", format: "percent" }] },
  { kind: "win_loss", title: "Win / loss", needs: "crm.view", description: "Deals closed in the period, by month.",
    columns: [{ key: "period", label: "Month", format: "text" }, { key: "won", label: "Won", format: "count" }, { key: "lost", label: "Lost", format: "count" },
      { key: "won_value_cents", label: "Won value", format: "money" }, { key: "win_rate", label: "Win rate", format: "percent" }] },
  { kind: "lost_reasons", title: "Lost reasons", needs: "crm.view", description: "Why deals closed lost in the period.",
    columns: [{ key: "reason", label: "Reason", format: "text" }, { key: "deals", label: "Deals", format: "count" }, { key: "value_cents", label: "Value", format: "money" }] },
  { kind: "lead_sources", title: "Lead sources", needs: "crm.view", description: "Leads added in the period by source, and how many became deals and wins.",
    columns: [{ key: "source", label: "Source", format: "text" }, { key: "leads", label: "Leads", format: "count" }, { key: "deals", label: "Deals", format: "count" },
      { key: "won", label: "Won", format: "count" }, { key: "won_value_cents", label: "Won value", format: "money" }] },
  { kind: "revenue", title: "Revenue", needs: "billing.view", description: "Orders by month: revenue, renewals, refunds and discounts.",
    columns: [{ key: "period", label: "Month", format: "text" }, { key: "orders", label: "Paid orders", format: "count" }, { key: "revenue_cents", label: "Revenue", format: "money" },
      { key: "renewals", label: "Renewals", format: "count" }, { key: "refunds", label: "Refunds", format: "count" }, { key: "discounts_cents", label: "Discounts", format: "money" }] },
  { kind: "comms_activity", title: "Communications activity", needs: "comms.view", description: "Calls, texts, emails and inbox messages, by day (or month for long ranges).",
    columns: [{ key: "period", label: "Period", format: "text" }, { key: "calls_in", label: "Calls in", format: "count" }, { key: "calls_out", label: "Calls out", format: "count" },
      { key: "texts_in", label: "Texts in", format: "count" }, { key: "texts_out", label: "Texts out", format: "count" }, { key: "emails_sent", label: "Emails sent", format: "count" },
      { key: "inbound_messages", label: "Inbox messages", format: "count" }] },
  { kind: "usage", title: "Product usage", needs: "analytics.view", description: "Signups, recordings and AI requests, by day (or month for long ranges).",
    columns: [{ key: "period", label: "Period", format: "text" }, { key: "signups", label: "Signups", format: "count" }, { key: "recordings", label: "Recordings", format: "count" },
      { key: "ai_requests", label: "AI requests", format: "count" }] },
];

export const reportDef = (kind: string | undefined) => REPORTS.find((r) => r.kind === kind);

export type SavedReport = { id: string; name: string; kind: string; range: string; since: string | null; until: string | null; shared: boolean; created_by: string };
