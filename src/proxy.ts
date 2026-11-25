import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { crawlerName } from "@/lib/analytics/channels";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // AI assistants and search engines reading the site (Admin -> Analytics -> AI).
  // Logged in the background after the response; page requests only.
  const bot = request.method === "GET" && !request.nextUrl.pathname.startsWith("/api/") ? crawlerName(request.headers.get("user-agent") ?? "") : null;
  if (bot) {
    event.waitUntil(fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/track_crawler`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "content-type": "application/json" },
      body: JSON.stringify({ p_bot: bot, p_path: request.nextUrl.pathname.slice(0, 300) }),
    }).then(() => undefined, () => undefined));
  }
  // The workspace CRM reuses the Admin CRM screens, whose links point at
  // /admin/contacts/… and so on. A link followed from a user-dashboard CRM
  // page stays in the user dashboard (lib/crm/scope.ts).
  const crm = request.nextUrl.pathname.match(ADMIN_CRM);
  if (crm && request.method === "GET") {
    const from = refererPath(request);
    if (from && USER_CRM.test(from)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${crm[1] === "workspace" ? "docs" : crm[1]}${crm[2] ?? ""}`;
      return NextResponse.redirect(url);
    }
  }
  return updateSession(request);
}

const ADMIN_CRM = /^\/admin\/(contacts|leads|clients|prospects|pipeline|plans|workspace|cards)(\/.*)?$/;
const USER_CRM = /^\/(contacts|leads|clients|prospects|pipeline|plans|docs|cards)(\/|$)/;
function refererPath(request: NextRequest): string | null {
  try {
    const ref = new URL(request.headers.get("referer") ?? "");
    return ref.origin === request.nextUrl.origin ? ref.pathname : null;
  } catch { return null; }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
