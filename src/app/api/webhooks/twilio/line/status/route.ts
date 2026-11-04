import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

// Call-line status. Signed by Twilio. Three uses:
// - announce=1: played to the other person before they're connected.
// - dial=1: the Dial (or conference) finished; hang up the member's leg.
// - otherwise: the outbound call's StatusCallback (ringing the member).

const FINAL: Record<string, string> = { completed: "completed", busy: "no_answer", "no-answer": "no_answer", failed: "failed", canceled: "canceled" };

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (url.searchParams.get("announce") === "1") return twiml("<Say>This call is being recorded.</Say>");
  if (!isUuid(id)) return url.searchParams.get("dial") ? twiml("<Hangup/>") : new Response(null, { status: 204 });
  const db = createAdminClient();
  const { data: call } = await db.from("call_line_calls").select("status, ended_at").eq("id", id).maybeSingle();
  if (!call) return url.searchParams.get("dial") ? twiml("<Hangup/>") : new Response(null, { status: 204 });

  if (url.searchParams.get("dial") === "1") {
    const answered = p.DialCallStatus === "completed" || !p.DialCallStatus;
    await db.from("call_line_calls").update({
      status: answered ? "completed" : FINAL[p.DialCallStatus] ?? "failed", ended_at: new Date().toISOString(),
      ...(p.DialCallDuration ? { duration_seconds: Number(p.DialCallDuration) || 0 } : {}),
    }).eq("id", id);
    return twiml(answered ? "<Hangup/>" : "<Say>They didn't answer. Goodbye.</Say><Hangup/>");
  }

  const final = FINAL[p.CallStatus ?? ""];
  if (final && !call.ended_at) {
    // The member never picked up (or hung up before connecting).
    const open = ["queued", "ringing_you"].includes(call.status);
    await db.from("call_line_calls").update({ ...(open ? { status: final === "completed" ? "canceled" : final } : {}), ended_at: new Date().toISOString() }).eq("id", id);
  }
  return new Response(null, { status: 204 });
}
