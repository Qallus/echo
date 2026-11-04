import { e164, twiml, verifyTwilio } from "@/lib/comms/twilio";
import { hook, workspacesFor } from "@/lib/line/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A call to the Echo line ("A call comes in" on ECHO_CALL_LINE). Signed by
// Twilio. "Record this call": a member on a call adds the Echo line and
// merges it in. Calls from a member's verified cell are recorded in a
// one-person conference (no beep, no hold music, no announcement unless
// they turned one on); recording stops when they hang up or drop the line.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const db = createAdminClient();
  const from = e164(p.From);
  const { data: phone } = from
    ? await db.from("call_line_phones").select("user_id, workspace_id, announce").eq("number", from).eq("status", "verified").maybeSingle()
    : { data: null };
  if (!phone) return twiml("<Say>This number records calls for Echo members. Verify your cell number in Echo to use it.</Say><Hangup/>");

  const workspaceId = phone.workspace_id ?? (await workspacesFor(db, phone.user_id)).personal?.id ?? null;
  const { data: call, error } = await db.from("call_line_calls").upsert({
    user_id: phone.user_id, kind: "merge", workspace_id: workspaceId, twilio_sid: p.CallSid, status: "in_progress",
  }, { onConflict: "twilio_sid" }).select("id").single();
  if (error || !call) { console.error("[call line voice]", error?.message); return twiml("<Say>Sorry, recording isn't available right now.</Say><Hangup/>"); }

  const announce = phone.announce ? "<Say>This call is being recorded.</Say>" : "";
  return twiml(`${announce}<Dial action="${hook("status", { call: call.id, dial: "1" })}"><Conference beep="false" waitUrl="" startConferenceOnEnter="true" endConferenceOnExit="true" record="record-from-start" recordingStatusCallback="${hook("recording", { call: call.id })}" recordingStatusCallbackEvent="completed">echo-${call.id}</Conference></Dial>`);
}
