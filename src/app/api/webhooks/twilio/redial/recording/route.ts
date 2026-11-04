import { after } from "next/server";
import { deleteRecording, fetchRecording, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { secret } from "@/lib/secrets";
import { transcribeWithOpenAI } from "@/lib/transcription/openai";
import { getTranscriptionSetting } from "@/lib/transcription/run";
import { createAdminClient } from "@/lib/supabase/admin";

// A Redial voicemail is ready. Signed by Twilio. Copies it to the private
// redial-voicemail bucket (<owner>/<call>.mp3), deletes Twilio's copy, then
// transcribes it; saving the message notifies the owner.

export const maxDuration = 300;

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const id = new URL(req.url).searchParams.get("call") ?? "";
  if (!isUuid(id) || p.RecordingStatus !== "completed" || !p.RecordingUrl) return new Response(null, { status: 204 });
  const seconds = Number(p.RecordingDuration ?? 0) || 0;

  after(async () => {
    const db = createAdminClient();
    const { data: call } = await db.from("redial_calls").select("owner_id").eq("id", id).maybeSingle();
    if (!call) return;
    const audio = await fetchRecording(p.RecordingUrl);
    if (!audio) return;
    const path = `${call.owner_id}/${id}.mp3`;
    const { error } = await db.storage.from("redial-voicemail").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (error) { console.error("[redial voicemail]", error.message); return; }
    if (p.RecordingSid) await deleteRecording(p.RecordingSid);
    await db.from("redial_calls").update({ recording_path: path, status: "message", ended_at: new Date().toISOString() }).eq("id", id);

    let text = seconds > 1 ? "" : "(No message left.)";
    const key = await secret("OPENAI_API_KEY");
    if (seconds > 1 && key) {
      try {
        const setting = await getTranscriptionSetting(db);
        const result = await transcribeWithOpenAI(audio, `${id}.mp3`, setting.model, seconds, key);
        text = result.segments.map((s) => s.text).join(" ").trim();
      } catch (e) {
        console.error("[redial voicemail transcript]", e instanceof Error ? e.message : e);
      }
    }
    await db.from("redial_calls").update({ message: text || "Voicemail (couldn't transcribe it; play the recording)." }).eq("id", id);
  });
  return new Response(null, { status: 204 });
}
