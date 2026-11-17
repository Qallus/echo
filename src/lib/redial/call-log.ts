import "server-only";
import { deleteRecording, fetchRecording, twilioRequest } from "@/lib/comms/twilio";
import { workspacesFor } from "@/lib/line/server";
import type { createAdminClient } from "@/lib/supabase/admin";
import { runTranscription } from "@/lib/transcription/run";

// The Redial call log (webhooks, service role): conversation recordings saved
// as Echo recordings (transcript, summary, action items, Ask AI) in the line
// owner's Personal workspace, and each call's Twilio cost.

type Db = ReturnType<typeof createAdminClient>;
const pretty = (n: string | null | undefined) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "unknown number");

export async function saveCallRecording(db: Db, callId: string, recordingUrl: string, recordingSid: string | undefined, seconds: number) {
  const { data: call } = await db.from("redial_calls").select("id, owner_id, direction, from_number, to_number, caller_name, caller_id_name, recording_id")
    .eq("id", callId).maybeSingle();
  if (!call || call.recording_id) return;
  const workspaceId = (await workspacesFor(db, call.owner_id)).personal?.id;
  if (!workspaceId) { console.error("[redial recording] no workspace for", callId); return; }
  const audio = await fetchRecording(recordingUrl);
  if (!audio) { console.error("[redial recording] couldn't download", callId); return; }

  const title = call.direction === "outbound"
    ? `Call with ${pretty(call.to_number)}`
    : `Call from ${call.caller_name || call.caller_id_name || pretty(call.from_number)}`;
  const { data: rec, error } = await db.from("recordings").insert({
    workspace_id: workspaceId, created_by: call.owner_id, title, source: "phone_call", duration_sec: Math.max(0, Math.round(seconds)), status: "processing",
  }).select("id").single();
  if (error || !rec) { console.error("[redial recording] row", error?.message); return; }
  const path = `${workspaceId}/${rec.id}/call.mp3`;
  const up = await db.storage.from("recordings").upload(path, audio, { contentType: "audio/mpeg", upsert: false });
  if (up.error) {
    console.error("[redial recording] upload", up.error.message);
    await db.from("recordings").delete().eq("id", rec.id);
    return;
  }
  await db.from("recordings").update({ storage_path: path }).eq("id", rec.id);
  await db.from("redial_calls").update({ recording_id: rec.id }).eq("id", callId);
  if (recordingSid) await deleteRecording(recordingSid);
  await runTranscription(db, rec.id);
}

// Twilio prices a call a little after it ends (its own leg plus any legs it
// dialed). Run from the comms cron: calls that ended over two minutes ago and
// have no cost yet. Gives up after a day, keeping what it found.
export async function fillCallCosts(db: Db, limit = 40): Promise<number> {
  const before = new Date(Date.now() - 2 * 60_000).toISOString();
  const after = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await db.from("redial_calls").select("id, twilio_sid, ended_at").is("cost_cents", null).not("twilio_sid", "is", null)
    .lt("ended_at", before).gt("ended_at", after).order("ended_at").limit(limit);
  let filled = 0;
  for (const c of data ?? []) {
    const [parent, children] = await Promise.all([
      twilioRequest(`/Calls/${c.twilio_sid}.json`, {}, "GET"),
      twilioRequest("/Calls.json", { ParentCallSid: c.twilio_sid!, PageSize: "20" }, "GET"),
    ]);
    if (!parent.ok) continue;
    const legs = [parent.data, ...(((children.data.calls ?? []) as Record<string, unknown>[]))];
    const prices = legs.map((l) => (l.price == null ? null : Math.abs(Number(l.price))));
    const pending = prices.some((p) => p == null || Number.isNaN(p));
    const oldEnough = Date.parse(c.ended_at!) < Date.now() - 3600_000;
    if (pending && !oldEnough) { await db.from("redial_calls").update({ cost_checked_at: new Date().toISOString() }).eq("id", c.id); continue; }
    const dollars = prices.reduce<number>((n, p) => n + (p ?? 0), 0);
    await db.from("redial_calls").update({ cost_cents: Math.round(dollars * 100_000) / 1000, cost_checked_at: new Date().toISOString() }).eq("id", c.id);
    filled++;
  }
  return filled;
}
