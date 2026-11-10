import type { Unit } from "@/components/admin/bar-chart";
import type { Permission } from "./permissions";

// The series on Admin -> Analytics. Each is one public.admin_series(metric)
// call; `needs` hides metrics a staff role can't see (the database checks too).

export type Metric = { id: string; title: string; unit: Unit; needs?: Permission };
export const METRIC_GROUPS: { title: string; metrics: Metric[] }[] = [
  { title: "Growth and usage", metrics: [
    { id: "signups", title: "Signups", unit: "count" }, { id: "active_users", title: "Users who recorded", unit: "count" },
    { id: "recordings", title: "Recordings", unit: "count" }, { id: "minutes", title: "Minutes recorded", unit: "minutes" },
  ] },
  { title: "Revenue", metrics: [
    { id: "revenue", title: "Revenue", unit: "money", needs: "billing.view" }, { id: "orders", title: "Paid orders", unit: "count", needs: "billing.view" },
  ] },
  { title: "Sales pipeline", metrics: [
    { id: "leads", title: "New leads", unit: "count", needs: "crm.view" }, { id: "deals_created", title: "Deals added", unit: "count", needs: "crm.view" },
    { id: "deals_won", title: "Deals won", unit: "count", needs: "crm.view" }, { id: "won_value", title: "Won value", unit: "money", needs: "crm.view" },
  ] },
  { title: "Communications", metrics: [
    { id: "calls", title: "Calls", unit: "count", needs: "comms.view" }, { id: "texts", title: "Texts", unit: "count", needs: "comms.view" },
    { id: "emails", title: "Emails sent", unit: "count", needs: "comms.view" }, { id: "inbound", title: "Inbox messages", unit: "count", needs: "comms.view" },
  ] },
  { title: "AI", metrics: [{ id: "ai_cost", title: "AI cost", unit: "money", needs: "ai.view" }] },
];

export const METRICS = METRIC_GROUPS.flatMap((g) => g.metrics);
