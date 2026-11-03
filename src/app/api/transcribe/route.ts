import { after } from "next/server";
import { getUser, isUuid } from "@/lib/data";
import { getBillingSettings } from "@/lib/billing/settings";
import { minutesUsage } from "@/lib/billing/usage";
import { createClient } from "@/lib/supabase/server";
import { runTranscription, startTranscription } from "@/lib/transcription/run";

// POST { recordingId } -> 202. Marks the recording as transcribing and does the
// work after responding; the recording page refreshes until it's done.
// Runs as the signed-in user, so RLS decides which recordings they can transcribe.
export const maxDuration = 900;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const recordingId = typeof body?.recordingId === "string" ? body.recordingId : "";
  if (!isUuid(recordingId)) return Response.json({ error: "Invalid recording." }, { status: 400 });

  const supabase = await createClient();
  // Minute limits apply only once Super Admin turns enforcement on.
  if ((await getBillingSettings(supabase)).enforceLimits) {
    const usage = await minutesUsage(supabase, user.id);
    if (usage.used >= usage.allowance) {
      return Response.json({ error: `You've used this month's ${usage.allowance.toLocaleString()} minutes. Add a minute pack or upgrade under Billing.` }, { status: 402 });
    }
  }
  const start = await startTranscription(supabase, recordingId);
  if (start.error) return Response.json({ error: start.error }, { status: 400 });
  if (start.running) return Response.json({ ok: true, running: true }, { status: 202 });

  after(() => runTranscription(supabase, recordingId));
  return Response.json({ ok: true }, { status: 202 });
}
