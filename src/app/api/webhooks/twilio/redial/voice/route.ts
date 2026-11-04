import { e164, twiml, verifyTwilio } from "@/lib/comms/twilio";
import { callToken, gatewayConfig } from "@/lib/redial/gateway";
import { ringOwner, stream, voicemail } from "@/lib/redial/twiml";
import { decide, type Line } from "@/lib/redial/types";
import { createAdminClient } from "@/lib/supabase/admin";

// A call to a Redial number ("A call comes in" on that Twilio number).
// Signed by Twilio. Applies the line's rules: block, ring through, or let the
// AI assistant screen it through the voice gateway. If the gateway isn't set
// up, unknown callers can leave a voicemail instead.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const db = createAdminClient();
  const to = e164(p.To);
  const { data: line } = to ? await db.from("redial_lines").select("*").eq("number", to).maybeSingle<Line>() : { data: null };
  if (!line) return twiml("<Say>Sorry, this number isn't in service.</Say><Hangup/>");

  const from = e164(p.From);
  const { data: entries } = from ? await db.from("redial_list_entries").select("number, kind").eq("line_id", line.id) : { data: [] };
  const decision = decide(line, from, entries ?? []);
  const gw = await gatewayConfig();
  const action = decision.action === "screen" && !gw.ready ? "voicemail" : decision.action;

  const { data: call, error } = await db.from("redial_calls").upsert({
    line_id: line.id, owner_id: line.owner_id, twilio_sid: p.CallSid, from_number: from ?? p.From ?? null,
    caller_id_name: p.CallerName || null, reason: action === decision.action ? decision.reason : `${decision.reason}; assistant not set up, so voicemail`,
    status: action === "block" ? "blocked" : action === "forward" ? "forwarded" : action === "screen" ? "screening" : "ringing",
    ...(action === "block" ? { ended_at: new Date().toISOString() } : {}),
  }, { onConflict: "twilio_sid" }).select("id").single();
  if (error || !call) {
    console.error("[redial voice]", error?.message);
    return twiml(line.forward_to ? `<Dial timeout="25">${line.forward_to}</Dial>` : "<Say>Sorry, please try again later.</Say><Hangup/>");
  }

  switch (action) {
    case "block": return twiml(`<Reject reason="busy"/>`);
    case "forward": return twiml(ringOwner(line, call.id, false));
    case "screen": return twiml(stream(gw.url!, callToken(gw.secret!, call.id), call.id));
    default: return twiml(voicemail(call.id, `Hi, you've reached ${line.label === "My line" ? "this number" : line.label}. Please leave your name, number and a short message after the tone.`));
  }
}
