import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { mobileToken } from "@/lib/mobile/context";
import { clientForToken } from "./token";

// The signed-in member's client: their cookie session on the web, or the
// Redial app's access token inside the mobile API.
export async function createClient() {
  const token = mobileToken();
  if (token) return clientForToken(token);
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; the proxy refreshes the session.
          }
        },
      },
    },
  );
}
