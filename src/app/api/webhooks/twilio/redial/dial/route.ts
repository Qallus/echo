import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { voicemail } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// After ringing the owner (Dial action) or after a voicemail (done=1).
// Answered and accepted: done. Otherwise the caller can leave a message.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (!isUuid(id) || url.searchParams.get("done") === "1") return twiml("<Hangup/>");
  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("status").eq("id", id).maybeSingle();
  if (!call) return twiml("<Hangup/>");

  if (p.DialCallStatus === "completed") {
    await db.from("redial_calls").update({ status: call.status === "connecting" ? "connected" : "forwarded", ended_at: new Date().toISOString() }).eq("id", id);
    return twiml("<Hangup/>");
  }
  await db.from("redial_calls").update({ status: "missed", reason: "Didn't answer" }).eq("id", id);
  return twiml(voicemail(id, call.status === "connecting"
    ? "Sorry, they couldn't pick up. Please leave a message after the tone and they'll get back to you."
    : "Sorry, no one can take your call right now. Please leave your name, number and a message after the tone."));
}
