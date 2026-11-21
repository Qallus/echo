import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isBot, isChannel } from "@/lib/analytics/channels";

// Collects page views and conversions from the public site (no sign-in).
// The visitor is an anonymous hash of the address and browser that changes
// every day; neither is stored. Bots are dropped. Writes through
// public.track_site_event(), which checks every field.

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return new Response(null, { status: 204 });
  let b: Record<string, unknown>;
  try { b = JSON.parse((await req.text()).slice(0, 4000)); } catch { return new Response(null, { status: 400 }); }
  if (b.kind !== "view" && b.kind !== "conversion") return new Response(null, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.AI_KEYS_SECRET || "redial-analytics";
  const visitor = createHmac("sha256", salt).update(`${day}|${ip}|${ua}`).digest("hex").slice(0, 16);
  const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  const country = (req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();

  await anon().rpc("track_site_event", { p: {
    kind: b.kind, name: str(b.name, 40), path: str(b.path, 300), referrer_host: str(b.referrer_host, 200),
    channel: isChannel(b.channel) ? b.channel : "direct", source: str(b.source, 100), medium: str(b.medium, 60),
    campaign: str(b.campaign, 120), landing: str(b.landing, 300), visitor, session: str(b.session, 40), device,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
  } });
  return new Response(null, { status: 204 });
}
