import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { ringOwner, voicemail } from "@/lib/redial/twiml";
import type { Line } from "@/lib/redial/types";
import { createAdminClient } from "@/lib/supabase/admin";

// The AI conversation has ended (the gateway closed the stream). If the
// assistant asked to put the caller through, ring the owner; otherwise hang
// up. If the stream never really ran, fall back to voicemail.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const id = new URL(req.url).searchParams.get("call") ?? "";
  if (!isUuid(id)) return twiml("<Hangup/>");
  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("id, status, connect_requested, summary, message, line:redial_lines(*)").eq("id", id).maybeSingle();
  const line = call?.line as unknown as Line | null;
  if (!call || !line) return twiml("<Hangup/>");

  if (call.connect_requested && line.allow_connect && line.forward_to && !line.paused) {
    await db.from("redial_calls").update({ status: "connecting" }).eq("id", id);
    return twiml(ringOwner(line, id, true));
  }
  if (call.status === "screening" && !call.summary && !call.message) {
    await db.from("redial_calls").update({ reason: "The assistant couldn't take the call; voicemail instead" }).eq("id", id);
    return twiml(voicemail(id, "Sorry, I can't take your call right now. Please leave your name, number and a message after the tone."));
  }
  await db.from("redial_calls").update({ status: call.message ? "message" : "completed", ended_at: new Date().toISOString() }).eq("id", id).in("status", ["screening"]);
  return twiml("<Hangup/>");
}
