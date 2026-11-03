"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isUuid } from "@/lib/data";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: string };

// Each action: requireStaff (MFA + permission), then a database function that
// checks the permission again and writes the audit log, and only then any
// Supabase admin API call (the approved service-role exception, see admin.ts).

// Locks the account: blocks workspace data at once (RLS), ends every session,
// and bans sign-in until restored.
export async function suspendUser(userId: string, reason: string): Promise<Result> {
  await requireStaff("users.manage");
  if (!isUuid(userId)) return { error: "Invalid user." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_suspend_user", { p_user: userId, p_reason: reason.slice(0, 500) });
  if (error) return { error: error.message };
  const ban = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  if (ban.error) return { error: `Suspended in Echo, but sign-in couldn't be blocked: ${ban.error.message}` };
  revalidatePath(`/admin/users/${userId}`);
  return { ok: "Suspended. They've been signed out and can't sign in." };
}

export async function restoreUser(userId: string): Promise<Result> {
  await requireStaff("users.manage");
  if (!isUuid(userId)) return { error: "Invalid user." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_user", { p_user: userId });
  if (error) return { error: error.message };
  const unban = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (unban.error) return { error: `Restored in Echo, but sign-in is still blocked: ${unban.error.message}` };
  revalidatePath(`/admin/users/${userId}`);
  return { ok: "Restored. They can sign in again." };
}

export async function signOutUserEverywhere(userId: string): Promise<Result> {
  await requireStaff("users.manage");
  if (!isUuid(userId)) return { error: "Invalid user." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_sign_out_user", { p_user: userId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  return { ok: "Signed out on every device." };
}

// Emails an invitation to create an Echo account.
export async function inviteUser(email: string): Promise<Result> {
  await requireStaff("users.manage");
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  // The audit call doubles as the database-side staff check before the admin API.
  const { error: auditError } = await supabase.rpc("admin_audit", { p_action: "user.invite", p_target_type: "email", p_target_id: clean });
  if (auditError) return { error: auditError.message };
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(clean, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    await adminAudit(supabase, "user.invite_failed", { type: "email", id: clean }, { error: error.message });
    return { error: error.message.includes("already") ? "That email already has an Echo account." : error.message };
  }
  revalidatePath("/admin/users");
  return { ok: `Invitation sent to ${clean}.` };
}

export async function transferWorkspace(workspaceId: string, newOwnerId: string): Promise<Result> {
  await requireStaff("workspaces.manage");
  if (!isUuid(workspaceId) || !isUuid(newOwnerId)) return { error: "Invalid workspace or member." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_transfer_workspace", { p_workspace: workspaceId, p_new_owner: newOwnerId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { ok: "Ownership transferred. The previous owner is now an admin." };
}
