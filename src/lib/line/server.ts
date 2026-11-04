import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteRecording, fetchRecording, xml } from "@/lib/comms/twilio";
import { siteUrl } from "@/lib/notify/senders";
import { secret } from "@/lib/secrets";
import { runTranscription } from "@/lib/transcription/run";

// The Echo call line (Phase 4a): one platform Twilio number, ECHO_CALL_LINE,
// rings members and records their calls into Echo. Webhooks under
// /api/webhooks/twilio/line/* (signed by Twilio, service role).

export const lineNumber = async () => (await secret("ECHO_CALL_LINE")) ?? null;
export const hook = (path: string, params: Record<string, string> = {}) =>
  xml(siteUrl(`/api/webhooks/twilio/line/${path}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`));
export const pretty = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "Unknown number");

// The member's Personal workspace, and their first Business one.
export async function workspacesFor(db: SupabaseClient, userId: string) {
  const { data } = await db.from("workspace_members").select("workspace:workspaces(id, name, is_personal, created_at)").eq("user_id", userId);
  const list = ((data ?? []).map((r) => r.workspace) as unknown as { id: string; name: string; is_personal: boolean; created_at: string }[]).filter(Boolean)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { personal: list.find((w) => w.is_personal) ?? null, business: list.find((w) => !w.is_personal) ?? null };
}

// Twilio's recording is ready: save it as an Echo recording in the call's
// workspace, delete Twilio's copy, then transcribe and summarize it.
export async function saveCallRecording(db: SupabaseClient, callId: string, recordingUrl: string, recordingSid: string | undefined, seconds: number) {
  const { data: call } = await db.from("call_line_calls").select("id, user_id, kind, to_number, workspace_id, recording_id").eq("id", callId).maybeSingle();
  if (!call || call.recording_id) return;
  const workspaceId = call.workspace_id ?? (await workspacesFor(db, call.user_id)).personal?.id;
  if (!workspaceId) { console.error("[call line] no workspace for", callId); return; }
  const audio = await fetchRecording(recordingUrl);
  if (!audio) { console.error("[call line] couldn't download recording", callId); return; }

  const title = call.kind === "outbound" ? `Call with ${pretty(call.to_number)}` : "Recorded phone call";
  const { data: rec, error } = await db.from("recordings").insert({
    workspace_id: workspaceId, created_by: call.user_id, title, source: "phone_call", duration_sec: Math.max(0, Math.round(seconds)), status: "processing",
  }).select("id").single();
  if (error || !rec) { console.error("[call line] recording row", error?.message); return; }
  const path = `${workspaceId}/${rec.id}/call.mp3`;
  const up = await db.storage.from("recordings").upload(path, audio, { contentType: "audio/mpeg", upsert: false });
  if (up.error) {
    console.error("[call line] upload", up.error.message);
    await db.from("recordings").delete().eq("id", rec.id);
    return;
  }
  await db.from("recordings").update({ storage_path: path }).eq("id", rec.id);
  await db.from("call_line_calls").update({ recording_id: rec.id, workspace_id: workspaceId, duration_seconds: Math.round(seconds) }).eq("id", callId);
  if (recordingSid) await deleteRecording(recordingSid);
  await runTranscription(db, rec.id);
}
