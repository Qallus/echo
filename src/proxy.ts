import type { NextFetchEvent, NextRequest } from "next/server";
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
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
