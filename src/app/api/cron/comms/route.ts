import { timingSafeEqual } from "node:crypto";
import { processDueRuns, queueTimed } from "@/lib/comms/automations";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled job (a Coolify scheduled task every 5 minutes):
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://echo.redial.si/api/cron/comms
// No user session: the shared CRON_SECRET is checked, then the service role
// queues time-based automations and sends everything that's due.

export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  const queued = await queueTimed(db);
  const sent = await processDueRuns(db);
  return Response.json({ ok: true, queued, sent });
}

export const GET = run;
export const POST = run;
