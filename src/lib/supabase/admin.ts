import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Only for:
// - routes the database or a provider calls with no user session (e.g.
//   /api/notifications/deliver), after verifying the caller's secret;
// - Super Admin auth operations in src/lib/admin/actions/ (invite, ban), after
//   requireStaff() and a staff-checked database call that writes the audit log.
// Never import it anywhere else.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
