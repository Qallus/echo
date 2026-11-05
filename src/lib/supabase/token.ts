import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A client that runs every query as the token's user, so RLS decides access.
// Never the secret/service-role key. Used by the MCP connector and the mobile API.
export function clientForToken(token: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
