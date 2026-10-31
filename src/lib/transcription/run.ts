import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_TRANSCRIBE_BYTES, parseSetting, type TranscriptionSetting } from "./models";
import { transcribeWithOpenAI } from "./openai";

export async function getTranscriptionSetting(supabase: SupabaseClient): Promise<TranscriptionSetting> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "transcription").maybeSingle();
  return parseSetting(data?.value);
}

const STALE_MS = 15 * 60 * 1000; // a job "processing" longer than this is treated as dead

// Marks the recording as transcribing. "running" means a job is already in progress.
export async function startTranscription(supabase: SupabaseClient, recordingId: string): Promise<{ error?: string; running?: boolean }> {
  const { data: rec, error } = await supabase
    .from("recordings").select("id, status, storage_path, updated_at").eq("id", recordingId).maybeSingle();
  if (error || !rec) return { error: "Recording not found or you don't have access." };
  if (!rec.storage_path) return { error: "This recording has no audio to transcribe." };
  if (rec.status === "processing" && Date.now() - Date.parse(rec.updated_at) < STALE_MS) return { running: true };
  const { error: upErr } = await supabase
    .from("recordings").update({ status: "processing", processing_error: null }).eq("id", recordingId);
  return upErr ? { error: upErr.message } : {};
}

// Downloads the audio, transcribes it with the configured provider, and
// replaces the transcript. Runs after the HTTP response (see /api/transcribe).
export async function runTranscription(supabase: SupabaseClient, recordingId: string): Promise<void> {
  try {
    const { data: rec, error } = await supabase
      .from("recordings").select("storage_path, duration_sec").eq("id", recordingId).single();
    if (error || !rec?.storage_path) throw new Error("This recording has no audio to transcribe.");

    const { data: audio, error: dlErr } = await supabase.storage.from("recordings").download(rec.storage_path);
    if (dlErr || !audio) throw new Error(`Couldn't read the audio file: ${dlErr?.message ?? "not found"}`);
    if (audio.size > MAX_TRANSCRIBE_BYTES) {
      throw new Error(`The audio is ${(audio.size / 1024 / 1024).toFixed(0)} MB; transcription currently handles files up to 25 MB.`);
    }

    const setting = await getTranscriptionSetting(supabase);
    const fileName = rec.storage_path.split("/").pop() ?? "audio.webm";
    const result = await transcribeWithOpenAI(audio, fileName, setting.model, rec.duration_sec);
    if (!result.segments.length) throw new Error("No speech was found in this recording.");

    // New segments go after the old ones, then the old ones are removed, so a
    // failure never leaves the recording without a transcript.
    const { data: last } = await supabase
      .from("transcript_segments").select("position").eq("recording_id", recordingId)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const base = (last?.position ?? -1) + 1;
    for (let i = 0; i < result.segments.length; i += 500) {
      const chunk = result.segments.slice(i, i + 500).map((s, j) => ({ ...s, recording_id: recordingId, position: base + i + j }));
      const { error: insErr } = await supabase.from("transcript_segments").insert(chunk);
      if (insErr) throw new Error(insErr.message);
    }
    if (base > 0) await supabase.from("transcript_segments").delete().eq("recording_id", recordingId).lt("position", base);

    const { data: summary } = await supabase.from("summaries").select("recording_id").eq("recording_id", recordingId).maybeSingle();
    await supabase.from("recordings").update({
      status: summary ? "generated" : "none",
      processing_error: null,
      ...(result.durationSec && !rec.duration_sec ? { duration_sec: result.durationSec } : {}),
    }).eq("id", recordingId);
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error(`[transcribe] ${recordingId}:`, message);
    await supabase.from("recordings").update({ status: "failed", processing_error: message }).eq("id", recordingId);
  }
}
