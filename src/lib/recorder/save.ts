import { createClient } from "@/lib/supabase/client";
import type { RecordingSource } from "@/lib/types";

// Uploads run in the browser with the signed-in user's session, straight to
// Supabase Storage, so RLS and the bucket policies apply.

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // project file size limit (Supabase free plan)
export const ACCEPTED = "audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.aac,.ogg,.opus,.flac";
const EXT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg", mpga: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg",
  oga: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", webm: "audio/webm", mp4: "video/mp4",
};
const extType = (name: string) => EXT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
// Some systems report no type for .m4a and friends, so fall back to the extension.
export const isAcceptedFile = (f: File) =>
  f.type.startsWith("audio/") || f.type === "video/mp4" || f.type === "video/webm" || (!f.type && Boolean(extType(f.name)));
// Bucket type checks don't expect parameters like ";codecs=opus".
const contentTypeFor = (file: Blob, name: string) => file.type.split(";")[0] || extType(name) || "application/octet-stream";

export type NewRecording = {
  file: Blob;
  fileName: string; // stored as <workspace>/<recording>/<fileName>
  workspaceId: string;
  userId: string;
  title: string;
  source: RecordingSource;
  durationSec: number;
  createdAt?: string;
  highlights?: { startSec: number; text: string }[];
};

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(-120) || "audio";

// Creates the recording in its workspace, uploads the audio, then attaches
// highlights. If the upload fails the empty recording is removed again.
export async function saveRecording(r: NewRecording): Promise<string> {
  if (r.file.size > MAX_UPLOAD_BYTES) throw new Error(`"${r.title}" is over 50 MB, the current upload limit.`);
  const supabase = createClient();

  const { data: rec, error } = await supabase
    .from("recordings")
    .insert({
      workspace_id: r.workspaceId, created_by: r.userId, title: r.title.slice(0, 300) || "Untitled recording",
      source: r.source, duration_sec: r.durationSec, ...(r.createdAt ? { created_at: r.createdAt } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const path = `${r.workspaceId}/${rec.id}/${safeName(r.fileName)}`;
  const up = await supabase.storage.from("recordings").upload(path, r.file, {
    contentType: contentTypeFor(r.file, r.fileName),
    upsert: false,
  });
  if (up.error) {
    await supabase.from("recordings").delete().eq("id", rec.id);
    throw new Error(up.error.message.includes("exceeded") ? `"${r.title}" is over the upload size limit.` : up.error.message);
  }

  const linked = await supabase.from("recordings").update({ storage_path: path }).eq("id", rec.id);
  if (linked.error) throw new Error(linked.error.message);
  if (r.highlights?.length) {
    const { error: hErr } = await supabase.from("highlights").insert(
      r.highlights.map((h) => ({ recording_id: rec.id, start_sec: Math.max(0, Math.round(h.startSec)), text: h.text.slice(0, 2000) })),
    );
    // The recording and audio are saved; don't fail (and risk a duplicate on retry) over the notes.
    if (hErr) console.error("[recorder] highlights not saved:", hErr.message);
  }
  return rec.id;
}
