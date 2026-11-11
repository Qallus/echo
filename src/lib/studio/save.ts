import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET, studioAudioById } from "./data";
import type { StudioAudio, StudioKind, StudioSource } from "./types";

// Stores one recording: the file in the person's folder of the private
// bucket, then its row. Runs as the signed-in person (storage and table RLS).

const EXT: Record<string, string> = {
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a",
  "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/webm": "webm", "audio/flac": "flac",
};

export function audioMime(type: string, filename = ""): string | null {
  const t = type.split(";")[0].trim().toLowerCase();
  if (EXT[t]) return t;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? null;
}

// Length of a WAV file from its header (byte rate and data size), or null.
export function wavSeconds(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (bytes.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let byteRate = 0;
  for (let o = 12; o + 8 <= bytes.length;) {
    const id = tag(o);
    const size = view.getUint32(o + 4, true);
    if (id === "fmt ") byteRate = view.getUint32(o + 16, true);
    if (id === "data") return byteRate ? Math.min(size, bytes.length - o - 8) / byteRate : null;
    o += 8 + size + (size % 2);
  }
  return null;
}

export async function saveStudioFile(supabase: SupabaseClient, ownerId: string, f: {
  bytes: ArrayBuffer | Buffer; mime: string; name: string; source: StudioSource; kind?: StudioKind;
  description?: string | null; image?: string | null; duration?: number | null; aiProvider?: string | null; aiVoice?: string | null;
}): Promise<StudioAudio | { error: string }> {
  const id = crypto.randomUUID();
  const path = `${ownerId}/${id}.${EXT[f.mime] ?? "wav"}`;
  const body = f.bytes instanceof ArrayBuffer ? f.bytes : new Uint8Array(f.bytes);
  const size = body.byteLength;
  const duration = f.duration ?? (f.mime.includes("wav") ? wavSeconds(body instanceof Uint8Array ? body : new Uint8Array(body)) : null);
  const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: f.mime, upsert: false });
  if (up.error) return { error: `Couldn't store the file: ${up.error.message}` };
  const { error } = await supabase.from("studio_audio").insert({
    id, name: f.name.trim().slice(0, 120) || "Recording", description: f.description?.trim().slice(0, 1000) || null,
    kind: f.kind ?? "other", source: f.source, ai_provider: f.aiProvider ?? null, ai_voice: f.aiVoice?.slice(0, 80) ?? null,
    storage_path: path, mime: f.mime, size_bytes: size,
    duration_seconds: duration != null && Number.isFinite(duration) ? Math.round(duration * 100) / 100 : null,
    image: f.image && f.image.length <= 400000 && f.image.startsWith("data:image/") ? f.image : null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "Couldn't save the recording." };
  }
  return (await studioAudioById(supabase, id)) ?? { error: "Saved, but couldn't load it back." };
}
