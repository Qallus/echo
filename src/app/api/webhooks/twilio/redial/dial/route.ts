import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { liveAgentForLine, ringLiveAgent } from "@/lib/live-agents/handoff";
import { voicemail } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// After ringing the owner (Dial action), after ringing a Live Agent
// (&agent=<session>), or after a voicemail (done=1). Answered: done.
// Not answered by the owner: the booked Live Agent, if one covers this line
// right now. Otherwise the caller can leave a message.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (!isUuid(id) || url.searchParams.get("done") === "1") return twiml("<Hangup/>");
  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("status, line_id, from_number, reason, redial_lines (number)").eq("id", id).maybeSingle();
  if (!call) return twiml("<Hangup/>");
  const answered = p.DialCallStatus === "completed";

  // A Live Agent leg finished: record the session (answered seconds bill on-demand bookings).
  const session = url.searchParams.get("agent") ?? "";
  if (isUuid(session)) {
    const seconds = Math.max(0, Number(p.DialCallDuration ?? 0) || 0);
    await db.from("live_agent_call_sessions").update({
      status: answered ? "answered" : "missed", ended_at: new Date().toISOString(), billable_seconds: answered ? seconds : 0,
    }).eq("id", session);
    if (answered) {
      await db.from("redial_calls").update({ status: "connected", ended_at: new Date().toISOString() }).eq("id", id);
      return twiml("<Hangup/>");
    }
    await db.from("redial_calls").update({ status: "missed", reason: "No one answered" }).eq("id", id);
    return twiml(voicemail(id, "Sorry, no one can take your call right now. Please leave your name, number and a message after the tone."));
  }

  if (answered) {
    await db.from("redial_calls").update({ status: call.status === "connecting" ? "connected" : "forwarded", ended_at: new Date().toISOString() }).eq("id", id);
    return twiml("<Hangup/>");
  }

  // Nobody picked up: the booked Live Agent, when one covers this line now.
  const handoff = await liveAgentForLine(db, call.line_id);
  const lineNumber = (call.redial_lines as unknown as { number: string } | null)?.number;
  if (handoff && lineNumber) {
    const xmlOut = await ringLiveAgent(db, handoff, { callId: id, lineNumber, caller: call.from_number, reason: call.reason });
    if (xmlOut) {
      await db.from("redial_calls").update({ status: "connecting", reason: "Sent to Live Agent" }).eq("id", id);
      return twiml(xmlOut);
    }
  }

  await db.from("redial_calls").update({ status: "missed", reason: "Didn't answer" }).eq("id", id);
  return twiml(voicemail(id, call.status === "connecting"
    ? "Sorry, they couldn't pick up. Please leave a message after the tone and they'll get back to you."
    : "Sorry, no one can take your call right now. Please leave your name, number and a message after the tone."));
}
