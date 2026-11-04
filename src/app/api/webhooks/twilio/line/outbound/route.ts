import { twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { hook, pretty, workspacesFor } from "@/lib/line/server";
import { createAdminClient } from "@/lib/supabase/admin";

// "Call & record", once Echo has rung the member and they picked up. Only the
// member hears this. They press 1 (or 1 = Personal / 2 = Business when they
// asked to choose), which also stops their voicemail from placing the call.
// Then Echo dials the other person showing the member's own verified number,
// recording each side on its own channel. No announcement unless turned on.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (!isUuid(id)) return twiml("<Hangup/>");
  const db = createAdminClient();
  const { data: call } = await db.from("call_line_calls").select("id, user_id, to_number, workspace_id, status").eq("id", id).maybeSingle();
  const { data: phone } = call ? await db.from("call_line_phones").select("number, status, workspace_id, ask_workspace, announce").eq("user_id", call.user_id).maybeSingle() : { data: null };
  if (!call?.to_number || phone?.status !== "verified") return twiml("<Say>Sorry, this call can't be placed.</Say><Hangup/>");

  const ws = await workspacesFor(db, call.user_id);
  const choose = phone.ask_workspace && !call.workspace_id && ws.personal && ws.business;
  const digits = p.Digits;

  if (!digits) {
    await db.from("call_line_calls").update({ status: "ringing_you", twilio_sid: p.CallSid }).eq("id", id);
    const who = pretty(call.to_number).replace(/\D/g, "").split("").join(" ");
    const prompt = choose
      ? `Echo call to ${who}. Press 1 to save it to Personal, or 2 to save it to ${ws.business!.name}.`
      : `Echo call to ${who}. Press 1 to connect.`;
    return twiml(`<Gather numDigits="1" timeout="8" action="${hook("outbound", { call: id })}"><Say>${xml(prompt)}</Say></Gather><Say>No key pressed. Goodbye.</Say><Hangup/>`);
  }
  if (digits !== "1" && !(choose && digits === "2")) return twiml("<Say>Call canceled.</Say><Hangup/>");

  const workspaceId = call.workspace_id ?? (choose ? (digits === "2" ? ws.business!.id : ws.personal!.id) : phone.workspace_id ?? ws.personal?.id ?? null);
  await db.from("call_line_calls").update({ status: "connecting", workspace_id: workspaceId }).eq("id", id);
  const announce = phone.announce ? `<Say>This call is being recorded.</Say>` : "";
  return twiml(`${announce}<Dial callerId="${xml(phone.number)}" timeout="30" record="record-from-answer-dual" action="${hook("status", { call: id, dial: "1" })}" recordingStatusCallback="${hook("recording", { call: id })}" recordingStatusCallbackEvent="completed"><Number${phone.announce ? ` url="${hook("status", { call: id, announce: "1" })}"` : ""}>${xml(call.to_number)}</Number></Dial>`);
}
