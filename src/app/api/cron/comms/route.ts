import { timingSafeEqual } from "node:crypto";
import { sendBookingReminders, sendEventReminders } from "@/lib/bookings/reminders";
import { processRuleRuns, queueTimedRules } from "@/lib/automation/run";
import { processDueRuns, queueTimed } from "@/lib/comms/automations";
import { runScheduled } from "@/lib/comms/schedule";
import { processLookupQueue } from "@/lib/prospects/runner";
import { visibilityCron } from "@/lib/analytics/ai-visibility";
import { sendAnalyticsDigest } from "@/lib/analytics/digest";
import { syncSearchConsole } from "@/lib/analytics/search-console";
import { fillCallCosts } from "@/lib/redial/call-log";
import { sendWeeklySummaries } from "@/lib/redial/alerts";
import { secret } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled job (a Coolify scheduled task every 5 minutes):
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://redial.si/api/cron/comms
// No user session: the shared CRON_SECRET is checked, then the service role
// sends scheduled emails and texts that are due, queues time-based
// automations and rules, runs everything that's due, sends booking
// reminders, fills in Twilio's cost for Redial calls that just ended, and
// finishes prospect lookup runs nobody's page is driving, copies Google
// Search Console daily, runs the monthly AI visibility check and sends the
// Monday analytics digest.

export const maxDuration = 300;

async function authorized(req: Request) {
  const expected = await secret("CRON_SECRET");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || !given) return false;
  const a = Buffer.from(expected), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!(await authorized(req))) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  // Scheduled sends first, with most of the time budget (big text sends carry on next run).
  const scheduled = await runScheduled(db, 180_000);
  const queued = (await queueTimed(db)) + (await queueTimedRules(db));
  const sent = await processDueRuns(db);
  const rules = await processRuleRuns(db);
  const reminders = (await sendBookingReminders(db)) + (await sendEventReminders(db));
  // Twilio's price for Redial calls that just ended (no-op before the call-log migration).
  const costs = await fillCallCosts(db).catch(() => 0);
  // Sundays: fraud protection weekly summaries for trusted contacts.
  const summaries = await sendWeeklySummaries(db).catch((e) => { console.error("[weekly summary]", e); return 0; });
  // Prospect lookups left running when the page was closed.
  const lookups = await processLookupQueue(db, 60_000).catch((e) => { console.error("[prospect lookups]", e); return 0; });
  // Analytics: Search Console once a day, the monthly AI visibility check, the Monday digest.
  const search = await syncSearchConsole(db).then((r) => r.rows ?? 0, () => 0);
  const aiChecks = await visibilityCron(db, 45_000).catch((e) => { console.error("[ai visibility]", e); return 0; });
  const digest = await sendAnalyticsDigest(db).catch((e) => { console.error("[analytics digest]", e); return 0; });
  return Response.json({ ok: true, scheduled, queued, sent, rules, reminders, costs, summaries, lookups, search, aiChecks, digest });
}

export const GET = run;
export const POST = run;
