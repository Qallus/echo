import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Writes one row to admin_audit_log through the database function (staff
// only; rows can't be edited afterwards). Call after every admin change.
export async function adminAudit(
  supabase: SupabaseClient,
  action: string,
  target?: { type: string; id: string },
  detail: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc("admin_audit", {
    p_action: action, p_target_type: target?.type ?? null, p_target_id: target?.id ?? null, p_detail: detail,
  });
  if (error && !(await notStaffCrm())) console.error("[admin audit]", action, error.message);
}

// Customer workspace CRM changes (user dashboard) aren't logged as admin
// actions: the audit call is refused for non-staff, quietly.
async function notStaffCrm(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers");
    const path = (await headers()).get("x-redial-path") ?? "/admin";
    return !path.startsWith("/admin") && !path.startsWith("/api");
  } catch { return false; }
}
