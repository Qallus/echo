import { e164, twiml, verifyTwilio } from "@/lib/comms/twilio";
import { callToken, gatewayConfig } from "@/lib/redial/gateway";
import { conference, conferenceName, lineSipUris, ringOwner, stream, voicemail } from "@/lib/redial/twiml";
import { lineFlow, startFlowRun } from "@/lib/flows/runner";
import { decide, type Line } from "@/lib/redial/types";
import { MIN_SECONDS_TO_SCREEN, redialUsage } from "@/lib/redial/usage";
import { createAdminClient } from "@/lib/supabase/admin";

// A call to a Redial number ("A call comes in" on that Twilio number).
// Signed by Twilio. Applies the line's rules: block, ring through, or let the
// AI assistant screen it through the voice gateway. If the gateway isn't set
// up, or this month's screening minutes are used up, unknown callers can
// leave a voicemail instead. Lines with live routing run the screening as a
// conference (caller and AI as separate participants); otherwise, or if that
// can't start, the call streams to the gateway directly.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const db = createAdminClient();
  const to = e164(p.To);
  const { data: line } = to ? await db.from("redial_lines").select("*").eq("number", to).maybeSingle<Line>() : { data: null };
  if (!line) return twiml("<Say>Sorry, this number isn't in service.</Say><Hangup/>");

  const from = e164(p.From);
  const { data: entries } = from ? await db.from("redial_list_entries").select("number, kind").eq("line_id", line.id) : { data: [] };
  // Desk phones count as somewhere to ring, like the member's own number.
  const sipUris = await lineSipUris(db, line.id);
  const decision = decide({ ...line, forward_to: line.forward_to ?? (sipUris.length ? "sip" : null) }, from, entries ?? []);

  // A published call tree answers everyone except blocked callers and VIPs.
  const vip = Boolean(from && (entries ?? []).some((e) => e.number === from && e.kind === "vip"));
  const tree = decision.action !== "block" && !vip ? await lineFlow(db, line.id) : null;
  if (tree) {
    const { data: call, error: e } = await db.from("redial_calls").upsert({
      line_id: line.id, owner_id: line.owner_id, twilio_sid: p.CallSid, from_number: from ?? p.From ?? null,
      caller_id_name: p.CallerName || null, reason: `Call tree: ${tree.name}`, status: "ringing",
    }, { onConflict: "twilio_sid" }).select("id").single();
    if (!e && call) {
      try {
        return twiml(await startFlowRun(db, tree, line, { id: call.id, sid: p.CallSid, from, callerName: p.CallerName || null, to: line.number }));
      } catch (err) {
        console.error("[redial voice] call tree", err instanceof Error ? err.message : err);
      }
    } else console.error("[redial voice] call tree call row", e?.message);
  }
  const gw = await gatewayConfig();
  const usage = decision.action === "screen" && gw.ready ? await redialUsage(db, line.owner_id) : null;
  const outOfMinutes = Boolean(usage && usage.remaining_seconds < MIN_SECONDS_TO_SCREEN);
  const action = decision.action === "screen" && (!gw.ready || !usage || outOfMinutes) ? "voicemail" : decision.action;
  const fallback = !gw.ready ? "assistant not set up" : outOfMinutes ? "this month's screening minutes are used up" : "couldn't check minutes";

  const { data: call, error } = await db.from("redial_calls").upsert({
    line_id: line.id, owner_id: line.owner_id, twilio_sid: p.CallSid, from_number: from ?? p.From ?? null,
    caller_id_name: p.CallerName || null, reason: action === decision.action ? decision.reason : `${decision.reason}; ${fallback}, so voicemail`,
    status: action === "block" ? "blocked" : action === "forward" ? "forwarded" : action === "screen" ? "screening" : "ringing",
    ...(action === "block" ? { ended_at: new Date().toISOString() } : {}),
  }, { onConflict: "twilio_sid" }).select("id").single();
  if (error || !call) {
    console.error("[redial voice]", error?.message);
    return twiml(line.forward_to ? `<Dial timeout="25">${line.forward_to}</Dial>` : "<Say>Sorry, please try again later.</Say><Hangup/>");
  }

  switch (action) {
    case "block": return twiml(`<Reject reason="busy"/>`);
    case "forward": return twiml(ringOwner(line, call.id, false, sipUris));
    case "screen": {
      if (line.live_routing && gw.aiApp) {
        const { error: e } = await db.from("redial_live_sessions").upsert(
          { call_id: call.id, line_id: line.id, conference_name: conferenceName(call.id), caller_call_sid: p.CallSid },
          { onConflict: "call_id", ignoreDuplicates: true });
        if (!e) return twiml(conference(call.id));
        console.error("[redial voice] live session", e.message);
      }
      return twiml(stream(gw.url!, callToken(gw.secret!, call.id), call.id));
    }
    default: return twiml(voicemail(call.id, `Hi, you've reached ${line.label === "My line" ? "this number" : line.label}. Please leave your name, number and a short message after the tone.`));
  }
}
