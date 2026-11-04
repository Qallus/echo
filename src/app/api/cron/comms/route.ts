import { timingSafeEqual } from "node:crypto";
import { sendBookingReminders, sendEventReminders } from "@/lib/bookings/reminders";
import { processRuleRuns, queueTimedRules } from "@/lib/automation/run";
import { processDueRuns, queueTimed } from "@/lib/comms/automations";
import { secret } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled job (a Coolify scheduled task every 5 minutes):
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://echo.redial.si/api/cron/comms
// No user session: the shared CRON_SECRET is checked, then the service role
// queues time-based automations and rules, runs everything that's due, and
// sends booking reminders.

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
  const queued = (await queueTimed(db)) + (await queueTimedRules(db));
  const sent = await processDueRuns(db);
  const rules = await processRuleRuns(db);
  const reminders = (await sendBookingReminders(db)) + (await sendEventReminders(db));
  return Response.json({ ok: true, queued, sent, rules, reminders });
}

export const GET = run;
export const POST = run;
