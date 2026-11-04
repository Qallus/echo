import { after } from "next/server";
import { verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { saveCallRecording } from "@/lib/line/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A call-line recording is ready. Signed by Twilio. Saves it as an Echo
// recording, deletes Twilio's copy, then transcribes and summarizes it
// (after responding).

export const maxDuration = 900;

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const id = new URL(req.url).searchParams.get("call") ?? "";
  if (!isUuid(id) || p.RecordingStatus !== "completed" || !p.RecordingUrl) return new Response(null, { status: 204 });
  const seconds = Number(p.RecordingDuration ?? 0) || 0;
  if (seconds < 2) return new Response(null, { status: 204 });
  after(() => saveCallRecording(createAdminClient(), id, p.RecordingUrl, p.RecordingSid, seconds));
  return new Response(null, { status: 204 });
}
