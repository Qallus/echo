import { after } from "next/server";
import { syncCallActivity, transcribeCall } from "@/lib/comms/calls";
import { deleteRecording, fetchRecording, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

// A call recording or voicemail is ready. Signed by Twilio. Copies the audio
// into the private call-recordings bucket, deletes Twilio's copy, then
// transcribes it and files it on the CRM timeline (after responding).

export const maxDuration = 300;

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (!isUuid(id) || p.RecordingStatus !== "completed" || !p.RecordingUrl) return new Response(null, { status: 204 });

  const voicemail = url.searchParams.get("vm") === "1";
  const seconds = Number(p.RecordingDuration ?? 0) || 0;
  after(async () => {
    const db = createAdminClient();
    const audio = await fetchRecording(p.RecordingUrl);
    if (!audio) return;
    const path = `${id}${voicemail ? "-voicemail" : ""}.mp3`;
    const { error } = await db.storage.from("call-recordings").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (error) { console.error("[call recording]", error.message); return; }
    if (p.RecordingSid) await deleteRecording(p.RecordingSid);
    await db.from("phone_calls").update({
      recording_path: path, recording_seconds: seconds, transcript_status: seconds > 1 ? "pending" : null,
      ...(voicemail ? { voicemail: true, status: "voicemail" } : {}),
    }).eq("id", id);
    await syncCallActivity(db, id);
    if (seconds > 1) await transcribeCall(db, id, audio, seconds);
  });
  return new Response(null, { status: 204 });
}
