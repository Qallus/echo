import "server-only";

// Whether "Continue with Google" should show on the sign-in and sign-up pages:
// asks Supabase Auth whether the Google provider is turned on (its public
// settings endpoint), so the button appears as soon as it's enabled in the
// Supabase dashboard, with no redeploy. Checked at most every 5 minutes.
export async function googleAuthEnabled(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true") return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    if (!res.ok) return false;
    const body = (await res.json()) as { external?: { google?: boolean } };
    return body.external?.google === true;
  } catch {
    return false;
  }
}
