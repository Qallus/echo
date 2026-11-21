import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, sendEmail, siteUrl } from "@/lib/notify/senders";
import { loadOrganization } from "@/lib/settings/organization";
import { CHANNELS, isChannel } from "./channels";
import type { Analytics } from "./report";

// Monday analytics digest: last week vs the week before, the top channels,
// AI answer share, and anything that moved a lot. Emailed after 8am (the
// organization's time zone) to staff who can see Analytics, once a week.
// Runs from the scheduled job with the service role.

const ROLES = ["owner", "admin", "finance", "marketing", "analyst"]; // roles with analytics.view

const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
};

async function report(db: SupabaseClient, fromDays: number, toDays: number) {
  const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
  const { data } = await db.rpc("admin_analytics", { p_since: `${day(fromDays)}T00:00:00Z`, p_until: `${day(toDays)}T00:00:00Z` });
  return (data ?? null) as Analytics | null;
}

const move = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : now ? 100 : 0);

export async function sendAnalyticsDigest(db: SupabaseClient, now = new Date()): Promise<number> {
  const org = await loadOrganization(db);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: org.timezone, weekday: "short", hour: "numeric", hourCycle: "h23" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  if (parts.weekday !== "Mon" || Number(parts.hour) < 8) return 0;
  const week = isoWeek(now);
  const { data: state } = await db.from("platform_settings").select("value").eq("key", "analytics_digest").maybeSingle();
  if ((state?.value as { week?: string } | null)?.week === week) return 0;
  await db.from("platform_settings").upsert({ key: "analytics_digest", value: { week } }); // claim first: never twice

  const [cur, prev] = await Promise.all([report(db, 7, 0), report(db, 14, 7)]);
  if (!cur) return 0;
  const t = cur.totals, p = prev?.totals;
  const { data: run } = await db.from("ai_visibility_runs").select("id").eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: checks } = run ? await db.from("ai_visibility_checks").select("mentioned, error").eq("run_id", run.id) : { data: [] };
  const answered = (checks ?? []).filter((c) => !c.error);
  const share = answered.length ? Math.round((answered.filter((c) => c.mentioned).length / answered.length) * 100) : null;

  const lines = [
    `Last 7 days: ${t.visitors} visitors (${move(t.visitors, p?.visitors ?? 0) >= 0 ? "+" : ""}${move(t.visitors, p?.visitors ?? 0)}%), ${t.signups} signups, ${t.paying} paying, $${(t.revenue_cents / 100).toFixed(0)} revenue.`,
    `Top channels: ${cur.channels.slice(0, 3).map((c) => `${isChannel(c.channel) ? CHANNELS[c.channel] : c.channel} ${c.sessions}`).join(", ") || "none yet"}.`,
    `AI assistants sent ${cur.ai_sources.reduce((n, s) => n + s.sessions, 0)} visits${share !== null ? `; ${share}% of AI answers name Redial` : ""}.`,
  ];
  const swings = [
    p && Math.abs(move(t.visitors, p.visitors)) >= 50 && p.visitors >= 20 ? `Visitors ${t.visitors > p.visitors ? "jumped" : "dropped"} ${Math.abs(move(t.visitors, p.visitors))}%.` : null,
    p && Math.abs(move(t.signups, p.signups)) >= 50 && p.signups >= 5 ? `Signups ${t.signups > p.signups ? "jumped" : "dropped"} ${Math.abs(move(t.signups, p.signups))}%.` : null,
  ].filter(Boolean) as string[];
  const body = [...lines, ...(swings.length ? [`Worth a look: ${swings.join(" ")}`] : [])].join(" ");

  const { data: staff } = await db.from("platform_staff").select("user_id, role").in("role", ROLES);
  let sent = 0;
  for (const s of staff ?? []) {
    const { data: u } = await db.auth.admin.getUserById(s.user_id);
    const to = u?.user?.email;
    if (!to) continue;
    const r = await sendEmail(to, `Redial analytics: week of ${new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 10)}`,
      emailHtml({ title: "Your weekly analytics", body, url: siteUrl("/admin/analytics?range=7d"), cta: "Open Analytics", footer: "Sent every Monday to Redial staff who can see Analytics." }),
      `${body}\n\n${siteUrl("/admin/analytics?range=7d")}`, { idempotencyKey: `analytics-digest/${week}/${s.user_id}` });
    if (r.ok) sent++;
  }
  return sent;
}
