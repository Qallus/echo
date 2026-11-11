import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";

// /.well-known: OAuth discovery for the MCP connector (fetched without a session).
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/.well-known", "/book", "/card", "/s"];
// Signed-in visitors skip these and go where they were headed.
const SIGNED_OUT_ONLY = ["/login", "/signup", "/forgot-password"];
// Marketing pages (exact paths). "/" is the marketing site when signed out and
// the app Home (/home) when signed in.
const MARKETING = ["/", "/pricing", "/compatibility", "/redial/business", "/home-phone", "/business-phone", "/recording-studio", "/faq", "/cart", "/terms", "/privacy", "/developers", "/suspended", "/contact", "/unsubscribe"];

// Refreshes the auth session cookie on every request and sends signed-out
// visitors to /login. API routes check auth themselves and return 401.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Keep this call directly after createServerClient (see Supabase SSR docs).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  if (path === "/" && signedIn) {
    // Show the app Home at "/" (address unchanged), keeping any refreshed session cookies.
    const home = NextResponse.rewrite(new URL("/home", request.url));
    response.cookies.getAll().forEach((c) => home.cookies.set(c));
    return home;
  }
  const isPublic = MARKETING.includes(path) || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (!signedIn && !isPublic && !path.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Keep the query: /oauth/consent needs its authorization_id after sign-in.
    const back = path + request.nextUrl.search;
    url.search = back === "/home" ? "" : `?next=${encodeURIComponent(back)}`;
    return NextResponse.redirect(url);
  }
  if (signedIn && SIGNED_OUT_ONLY.includes(path)) {
    return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
  }
  return response;
}
