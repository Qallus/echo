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
  if (error) console.error("[admin audit]", action, error.message);
}
