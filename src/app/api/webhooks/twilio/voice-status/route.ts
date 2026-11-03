import { after } from "next/server";
import { syncCallActivity } from "@/lib/comms/calls";
import { twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { createAdminClient } from "@/lib/supabase/admin";

// The <Dial> finished (its "action"). Records the outcome; an unanswered
// incoming call goes to voicemail. ?done=1 ends the call after voicemail.
// Signed by Twilio.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (url.searchParams.get("done")) return twiml("<Hangup/>");
  if (!isUuid(id)) return twiml("<Hangup/>");

  const db = createAdminClient();
  const status = (p.DialCallStatus ?? p.CallStatus ?? "completed").slice(0, 40);
  const answered = status === "completed" || status === "answered";
  await db.from("phone_calls").update({
    status, duration_seconds: Number(p.DialCallDuration ?? p.CallDuration ?? 0) || null, ended_at: new Date().toISOString(),
  }).eq("id", id);

  if (url.searchParams.get("inbound") && !answered) {
    after(() => syncCallActivity(db, id));
    return twiml(`<Say>Sorry we missed your call. Please leave a message after the tone.</Say><Record maxLength="180" playBeep="true" action="${xml(siteUrl(`/api/webhooks/twilio/voice-status?call=${id}&done=1`))}" recordingStatusCallback="${xml(siteUrl(`/api/webhooks/twilio/recording?call=${id}&vm=1`))}" recordingStatusCallbackEvent="completed"/>`);
  }
  after(() => syncCallActivity(db, id));
  return twiml("<Hangup/>");
}
