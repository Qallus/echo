import { NextResponse, type NextRequest } from "next/server";
import { siteOrigin } from "@/lib/site";
import { getPersonalWorkspace, getUser } from "@/lib/data";
import { syncGoogleCalendar } from "@/lib/google/calendar-sync";
import { exchangeCode, seal, STATE_COOKIE } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

// Google sends people back here after the permission screen. Checks the
// state and PKCE verifier from the start route's cookie, swaps the code for
// tokens, stores them encrypted on the person's own connection row, then
// runs the first calendar sync.
export async function GET(req: NextRequest) {
  // Behind the proxy the request URL is the internal address; links use the public one.
  const origin = await siteOrigin();
  const p = req.nextUrl.searchParams;
  let saved: { state?: string; verifier?: string; next?: string } = {};
  try { saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}"); } catch { /* missing or bad cookie */ }
  const next = saved.next ?? "/settings/connections";
  const done = (q: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}${q}`, origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations/google" });
    return res;
  };

  if (p.get("error")) return done("error=google_denied");
  const code = p.get("code"), state = p.get("state");
  if (!code || !state || !saved.state || state !== saved.state || !saved.verifier) return done("error=google_state");
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings/connections", origin));

  try {
    const t = await exchangeCode(code, saved.verifier);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("account_connections").select("id, workspace_id, account_id").eq("user_id", user.id).eq("provider", "google").maybeSingle();
    const sameAccount = existing && existing.account_id === t.sub;
    if (!t.refresh_token && !sameAccount) throw new Error("Google didn't return a refresh token.");
    const row = {
      provider: "google", account_email: t.email, account_id: t.sub, scopes: (t.scope ?? "").split(" ").filter(Boolean).slice(0, 30),
      access_token: seal(t.access_token), expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      ...(t.refresh_token ? { refresh_token: seal(t.refresh_token) } : {}),
      // A different Google account starts fresh; the same one keeps its sync.
      ...(sameAccount ? {} : { sync_token: null, workspace_id: (await getPersonalWorkspace()).id }),
      status: "active", last_error: null,
    };
    const write = existing
      ? await supabase.from("account_connections").update(row).eq("id", existing.id)
      : await supabase.from("account_connections").insert(row);
    if (write.error) throw new Error(write.error.message);
    if (existing && !sameAccount) await supabase.from("calendar_sync_links").delete().eq("connection_id", existing.id);
    await syncGoogleCalendar(supabase, user.id);
    return done("connected=google");
  } catch (e) {
    console.error("[google-oauth] callback failed:", e instanceof Error ? e.message : e);
    return done("error=google_failed");
  }
}
