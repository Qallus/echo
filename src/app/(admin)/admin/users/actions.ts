"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/guard";
import { STAFF_ROLES, type StaffRole } from "@/lib/admin/permissions";
import { createClient } from "@/lib/supabase/server";

// Owners only. Adds, changes or removes (role = null) a staff member by email.
// The database function checks the permission again and writes the audit row.
export async function setStaffRole(email: string, role: StaffRole | null): Promise<{ error?: string; ok?: string }> {
  await requireStaff("staff.manage");
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { error: "Enter a valid email address." };
  if (role && !STAFF_ROLES.some((r) => r.role === role)) return { error: "Choose a role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_staff_role", { p_email: clean, p_role: role });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: role ? `${clean} is now ${STAFF_ROLES.find((r) => r.role === role)!.label}.` : `${clean} was removed from staff.` };
}
