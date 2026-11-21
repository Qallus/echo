import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/site";

// redial.si/l/<code>: counts the click (public.short_link_open) and sends the
// visitor on to the tagged page. Unknown codes go to the homepage.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = await siteOrigin();
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) return NextResponse.redirect(origin, 302);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.rpc("short_link_open", { p_code: code });
  const url = typeof data === "string" && /^https:\/\//.test(data) ? data : origin;
  return NextResponse.redirect(url, 302);
}
