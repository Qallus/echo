import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Permission, StaffRole } from "./permissions";

export type Staff = { role: StaffRole; mfaVerified: boolean; permissions: Permission[] };

// The signed-in user's staff role (null for customers). Permissions are empty
// until the session passes two-step sign-in.
export const getStaff = cache(async (): Promise<Staff | null> => {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_staff").maybeSingle<{ role: StaffRole; mfa_verified: boolean; permissions: Permission[] }>();
  return data ? { role: data.role, mfaVerified: data.mfa_verified, permissions: data.permissions ?? [] } : null;
});

export const can = (staff: Staff | null, permission: Permission) => Boolean(staff?.permissions.includes(permission));

// Every admin page and action starts here. Customers get a 404 (the admin
// area doesn't exist for them), unverified staff go to two-step sign-in,
// and staff without the permission get a 404 too.
export async function requireStaff(permission?: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) notFound();
  if (!staff.mfaVerified) redirect("/admin/mfa");
  if (permission && !can(staff, permission)) notFound();
  return staff;
}
