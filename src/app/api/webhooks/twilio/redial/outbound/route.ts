import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

// A desk phone's call ended (the Dial's action). Signed by Twilio. Records
// how it went and how long it lasted; the recording and the cost follow.

const STATUS: Record<string, { status: string; reason: string }> = {
  completed: { status: "completed", reason: "Answered" },
  answered: { status: "completed", reason: "Answered" },
  "no-answer": { status: "missed", reason: "No answer" },
  busy: { status: "missed", reason: "Busy" },
  canceled: { status: "missed", reason: "Hung up before they answered" },
  failed: { status: "failed", reason: "The call didn't go through" },
};

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const id = new URL(req.url).searchParams.get("call") ?? "";
  if (!isUuid(id)) return twiml("<Hangup/>");
  const outcome = STATUS[p.DialCallStatus ?? ""] ?? { status: "completed", reason: "Ended" };
  const db = createAdminClient();
  await db.from("redial_calls").update({
    status: outcome.status, reason: outcome.reason, duration_seconds: Math.max(0, Number(p.DialCallDuration ?? 0) || 0),
    ended_at: new Date().toISOString(), read_at: new Date().toISOString(), // your own call isn't "unread"
  }).eq("id", id).eq("direction", "outbound");
  return twiml("<Hangup/>");
}
