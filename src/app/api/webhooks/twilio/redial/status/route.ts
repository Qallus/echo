import { verifyTwilio } from "@/lib/comms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

// Call status callback for Redial numbers (set as the number's "Call status
// changes" URL). Signed by Twilio. Records the length and closes out calls
// that ended mid-screening (caller hung up).

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  if (!p.CallSid || !["completed", "busy", "failed", "no-answer", "canceled"].includes(p.CallStatus ?? "")) return new Response(null, { status: 204 });
  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("id, status, ended_at").eq("twilio_sid", p.CallSid).maybeSingle();
  if (!call) return new Response(null, { status: 204 });
  const open = ["ringing", "screening", "connecting"].includes(call.status);
  await db.from("redial_calls").update({
    duration_seconds: Number(p.CallDuration ?? 0) || 0, ended_at: call.ended_at ?? new Date().toISOString(),
    ...(open ? { status: call.status === "screening" ? "completed" : p.CallStatus === "completed" ? "missed" : "failed" } : {}),
  }).eq("id", call.id);
  return new Response(null, { status: 204 });
}
