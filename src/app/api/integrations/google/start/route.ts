import { NextResponse, type NextRequest } from "next/server";
import { siteOrigin } from "@/lib/site";
import { getUser } from "@/lib/data";
import { authStart, googleKeys, STATE_COOKIE } from "@/lib/google/oauth";

// Settings -> Connected accounts -> Connect Google: send the signed-in person
// to Google's permission screen.
export async function GET(req: NextRequest) {
  // Behind the proxy the request URL is the internal address; links use the public one.
  const origin = await siteOrigin();
  const back = (q: string) => NextResponse.redirect(new URL(`/settings/connections?${q}`, origin));
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings/connections", origin));
  const keys = await googleKeys();
  if (!keys) return back("error=google_not_configured");
  const next = req.nextUrl.searchParams.get("next");
  const { url, cookie } = await authStart(keys.id, next && /^\/[a-z0-9/_-]*$/i.test(next) ? next : "/settings/connections");
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, cookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/integrations/google", maxAge: 600 });
  return res;
}
