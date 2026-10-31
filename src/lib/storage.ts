import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Audio lives at <workspace_id>/<recording_id>/<file> and access is checked
// by that first folder. After a recording changes workspace, its file must
// follow, or the old workspace's members could still play it.
export async function relocateAudio(supabase: SupabaseClient, recordingId: string): Promise<void> {
  const { data } = await supabase.from("recordings").select("workspace_id, storage_path").eq("id", recordingId).maybeSingle();
  if (!data?.storage_path) return;
  const [prefix, ...rest] = data.storage_path.split("/");
  if (prefix === data.workspace_id) return;

  const to = [data.workspace_id, ...rest].join("/");
  const { error } = await supabase.storage.from("recordings").move(data.storage_path, to);
  if (error) {
    // Put the recording back where its audio is, rather than leave the file readable by the old workspace.
    await supabase.from("recordings").update({ workspace_id: prefix }).eq("id", recordingId);
    throw new Error(`Its audio file couldn't be moved (${error.message}), so the recording stayed where it was.`);
  }
  const { error: upErr } = await supabase.from("recordings").update({ storage_path: to }).eq("id", recordingId);
  if (upErr) throw new Error(upErr.message);
}

// Short-lived link for playing a recording's audio (bucket is private).
export async function audioUrl(supabase: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("recordings").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}
