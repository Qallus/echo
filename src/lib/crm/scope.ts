import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, type Staff } from "@/lib/admin/guard";
import type { Permission, StaffRole } from "@/lib/admin/permissions";
import { listWorkspaces, requireUser } from "@/lib/data";
import { columnReady, staffFilter } from "@/lib/schema-ready";

// One CRM (contacts, pipeline, plans, docs, cards), two owners:
//  * under /admin it's Redial staff's own CRM (workspace_id is null), gated by
//    staff permissions as before;
//  * everywhere else (the user dashboard) it's the chosen Personal or Business
//    workspace's private CRM, for its members.
// The proxy passes the page path (x-redial-path); server actions post to their
// page, so pages and actions agree. RLS checks the same rule in the database.

export const WS_COOKIE = "redial_crm_ws";

export type CrmScope = { staff: true; workspaceId: null; base: "/admin" } | { staff: false; workspaceId: string; base: "" };

export const crmScope = cache(async (): Promise<CrmScope> => {
  const path = (await headers()).get("x-redial-path") ?? "/admin";
  if (path.startsWith("/admin") || path.startsWith("/api")) return { staff: true, workspaceId: null, base: "/admin" };
  const workspaces = await listWorkspaces();
  const want = (await cookies()).get(WS_COOKIE)?.value;
  const ws = workspaces.find((w) => w.id === want) ?? workspaces.find((w) => w.isPersonal) ?? workspaces[0];
  if (!ws) return { staff: true, workspaceId: null, base: "/admin" };
  return { staff: false, workspaceId: ws.id, base: "" };
});

/** The workspace CRM migration has been run. */
export const workspaceCrmReady = () => columnReady("crm_contacts", "workspace_id");

const MEMBER: Staff = { role: "member" as StaffRole, mfaVerified: true, permissions: ["crm.view", "crm.manage", "projects.manage"] as Permission[] };

// In place of requireStaff() on CRM pages and actions: staff rules under
// /admin; in the user dashboard any signed-in member of the workspace (RLS
// decides row by row).
export async function crmGuard(permission?: Permission): Promise<Staff> {
  const scope = await crmScope();
  if (scope.staff) return requireStaff(permission);
  await requireUser();
  // Paid tools and platform settings (carrier lookups, business search) stay with staff.
  if (permission && !MEMBER.permissions.includes(permission)) notFound();
  if (!(await workspaceCrmReady())) throw new Error("This needs a database update first (the workspace CRM SQL).");
  return MEMBER;
}

type Scopable<T> = { is(column: string, value: null): T; eq(column: string, value: string): T };
export type ScopeFilter = <T extends Scopable<T>>(q: T) => T;

/** A filter that limits a query to the current CRM: staff rows, or this workspace's rows. */
export async function scopeFor(table: string): Promise<ScopeFilter> {
  const scope = await crmScope();
  if (!scope.staff) return (q) => q.eq("workspace_id", scope.workspaceId);
  const staff = await staffFilter(table);
  return (q) => staff(q);
}

/** Fields to add to an insert so the new row lands in the current CRM. */
export async function scopeStamp(): Promise<{ workspace_id?: string }> {
  const scope = await crmScope();
  return scope.staff ? {} : { workspace_id: scope.workspaceId };
}

/** Refreshes an admin CRM page and its user-dashboard twin. */
export function revalidateCrm(path: string, type?: "layout" | "page") {
  revalidatePath(path, type);
  const user = path.replace(/^\/admin(?=\/|$)/, "").replace(/^\/workspace(?=\/|$)/, "/docs");
  if (user !== path) revalidatePath(user || "/", type);
}

/** A path in the current CRM: "/admin/contacts/1" or "/contacts/1" (docs live at /docs). */
export async function crmHref(path: string): Promise<string> {
  const scope = await crmScope();
  return scope.staff ? `/admin${path}` : path.replace(/^\/workspace(?=\/|$)/, "/docs");
}
