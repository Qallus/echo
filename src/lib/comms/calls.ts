import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeWithOpenAI } from "@/lib/transcription/openai";
import { getTranscriptionSetting } from "@/lib/transcription/run";
import { secret } from "@/lib/secrets";

// Calls on the CRM timeline and their transcripts. Used by the Twilio
// webhooks with the service-role client (no user session there).

type Call = {
  id: string; direction: "inbound" | "outbound"; from_number: string | null; to_number: string | null; status: string;
  duration_seconds: number | null; twilio_sid: string | null; recording_path: string | null; voicemail: boolean;
  transcript: string | null; staff_id: string | null; contact_id: string | null; deal_id: string | null; activity_id: string | null; created_at: string;
};

const label = (c: Call) => (c.voicemail ? "Voicemail" : c.status === "completed" ? "Call" : `Call (${c.status.replace("-", " ")})`);

// One timeline entry per call (kind call, or voicemail), linked to its contact
// and deal. Safe to call more than once: it updates the same entry.
export async function syncCallActivity(db: SupabaseClient, callId: string) {
  const { data: c } = await db.from("phone_calls").select("*").eq("id", callId).maybeSingle<Call>();
  if (!c || !c.twilio_sid || (!c.contact_id && !c.deal_id)) return;
  let companyId: string | null = null;
  if (c.contact_id) companyId = (await db.from("crm_contacts").select("company_id").eq("id", c.contact_id).maybeSingle()).data?.company_id ?? null;
  const row = {
    kind: c.voicemail ? "voicemail" : "call", direction: c.direction, subject: label(c), status: c.status,
    body: c.transcript ? c.transcript.slice(0, 100000) : "", transcript: c.transcript, duration_seconds: c.duration_seconds,
    recording_path: c.recording_path, from_addr: c.from_number, to_addr: c.to_number, external_id: c.twilio_sid,
    contact_id: c.contact_id, company_id: companyId, deal_id: c.deal_id, occurred_at: c.created_at, created_by: c.staff_id,
  };
  if (c.activity_id) {
    await db.from("crm_activities").update(row).eq("id", c.activity_id);
    return;
  }
  const { data, error } = await db.from("crm_activities").insert(row).select("id").single();
  if (data) await db.from("phone_calls").update({ activity_id: data.id }).eq("id", c.id);
  else if (error?.code === "23505") await db.from("crm_activities").update(row).eq("kind", row.kind).eq("external_id", c.twilio_sid);
}

// Transcribes a saved recording with Echo's OpenAI key and the admin's chosen
// model, then refreshes the timeline entry.
export async function transcribeCall(db: SupabaseClient, callId: string, audio: Blob, seconds: number) {
  const key = await secret("OPENAI_API_KEY");
  if (!key) { await db.from("phone_calls").update({ transcript_status: "failed" }).eq("id", callId); return; }
  try {
    const setting = await getTranscriptionSetting(db);
    const result = await transcribeWithOpenAI(audio, `${callId}.mp3`, setting.model, seconds, key);
    const text = result.segments.map((s) => (s.speaker && result.segments.some((x) => x.speaker !== s.speaker) ? `${s.speaker}: ${s.text}` : s.text)).join("\n");
    await db.from("phone_calls").update({ transcript: text.slice(0, 200000), transcript_status: "done" }).eq("id", callId);
  } catch (e) {
    console.error("[call transcript]", e instanceof Error ? e.message : e);
    await db.from("phone_calls").update({ transcript_status: "failed" }).eq("id", callId);
  }
  await syncCallActivity(db, callId);
}
