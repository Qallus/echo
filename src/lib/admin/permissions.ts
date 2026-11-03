// Super Admin staff roles and what each can do. Mirrors
// private.role_permissions() in supabase/migrations/20261102090000_admin_staff.sql;
// the database is the real check, this decides what the UI shows.

export type StaffRole = "owner" | "admin" | "support" | "finance" | "marketing" | "analyst";

export type Permission =
  | "dashboard.view" | "analytics.view"
  | "users.view" | "users.manage" | "workspaces.view" | "workspaces.manage" | "staff.manage"
  | "billing.view" | "billing.manage" | "ai.view" | "ai.manage" | "notifications.view"
  | "crm.view" | "crm.manage" | "content.manage" | "settings.manage" | "audit.view";

export const STAFF_ROLES: { role: StaffRole; label: string; detail: string }[] = [
  { role: "owner", label: "Owner", detail: "Everything, including adding and removing staff." },
  { role: "admin", label: "Admin", detail: "Everything except managing staff." },
  { role: "support", label: "Support", detail: "Users, workspaces, notifications and the CRM." },
  { role: "finance", label: "Finance", detail: "Billing, revenue and reports." },
  { role: "marketing", label: "Marketing", detail: "CRM, content and analytics." },
  { role: "analyst", label: "Analyst", detail: "Read-only: users, billing, AI usage and analytics." },
];

export const roleLabel = (role: StaffRole) => STAFF_ROLES.find((r) => r.role === role)?.label ?? role;
