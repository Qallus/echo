"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { e164, twilioSms } from "@/lib/comms/twilio";
import { ref, refresh, text, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Texts and calls from the admin (comms.manage, audited without message text).

const done = <T extends Result>(r: T): T => { revalidatePath("/admin/communications"); refresh(); return r; };

// Sends from Echo's number. Refuses numbers that texted STOP. Logs on the CRM
// timeline when the number belongs to a contact (or a contact/deal is given).
export async function sendText(input: { to: string; body: string; contactId?: string | null; dealId?: string | null }): Promise<Result> {
  await requireStaff("comms.manage");
  const to = e164(input.to);
  const body = text(input.body, 1600);
  if (!to) return { error: "Enter a valid phone number, e.g. (480) 555-0142." };
  if (!body) return { error: "Write a message." };
  const supabase = await createClient();
  const { data: optedOut } = await supabase.from("phone_opt_outs").select("number").eq("number", to).maybeSingle();
  if (optedOut) return { error: "This number replied STOP. They have to text START before you can text them." };

  let contactId = ref(input.contactId);
  let companyId: string | null = null;
  if (!contactId) {
    const digits = to.replace(/\D/g, "").slice(-10);
    const { data } = await supabase.from("crm_contacts").select("id, company_id, phone").ilike("phone", `%${digits.slice(-4)}%`).limit(200);
    const match = (data ?? []).find((c) => (c.phone ?? "").replace(/\D/g, "").slice(-10) === digits);
    contactId = match?.id ?? null;
    companyId = match?.company_id ?? null;
  }
  const res = await twilioSms(to, body);
  await supabase.from("phone_messages").insert({
    direction: "outbound", from_number: process.env.TWILIO_FROM_NUMBER ?? "", to_number: to, body, status: res.ok ? res.status ?? "queued" : "failed",
    error: res.error?.slice(0, 500) ?? null, twilio_sid: res.sid ?? null, contact_id: contactId, deal_id: ref(input.dealId),
  });
  if (!res.ok) return { error: res.error ?? "Couldn't send." };
  if (contactId || input.dealId) {
    await supabase.from("crm_activities").insert({
      kind: "sms", direction: "outbound", body, status: "sent", to_addr: to, contact_id: contactId, company_id: companyId, deal_id: ref(input.dealId),
    });
  }
  await adminAudit(supabase, "comms.text.send", { type: "phone", id: to }, { contact_id: contactId, deal_id: ref(input.dealId) });
  return done({ ok: "Text sent." });
}

export async function markThreadRead(number: string): Promise<Result> {
  await requireStaff("comms.manage");
  const n = e164(number) ?? number;
  const supabase = await createClient();
  await supabase.from("phone_messages").update({ read_at: new Date().toISOString() }).eq("direction", "inbound").eq("from_number", n).is("read_at", null);
  revalidatePath("/admin/communications");
  return { ok: "Read." };
}

// A short-lived link to play a call recording (staff with comms.view).
export async function recordingLink(callId: string): Promise<{ url?: string; error?: string }> {
  await requireStaff("comms.view");
  if (!isUuid(callId)) return { error: "Not found." };
  const supabase = await createClient();
  const { data: call } = await supabase.from("phone_calls").select("recording_path").eq("id", callId).maybeSingle();
  if (!call?.recording_path) return { error: "No recording." };
  const { data, error } = await supabase.storage.from("call-recordings").createSignedUrl(call.recording_path, 600);
  return error ? { error: error.message } : { url: data.signedUrl };
}

// Notes on a call, or linking it to a contact or deal (the timeline follows).
export async function updateCall(callId: string, patch: { notes?: string; contactId?: string | null; dealId?: string | null }): Promise<Result> {
  await requireStaff("comms.manage");
  if (!isUuid(callId)) return { error: "Not found." };
  const row: Record<string, unknown> = {};
  if ("notes" in patch) row.notes = text(patch.notes, 10000);
  if ("contactId" in patch) row.contact_id = ref(patch.contactId);
  if ("dealId" in patch) row.deal_id = ref(patch.dealId);
  const supabase = await createClient();
  const { data: call, error } = await supabase.from("phone_calls").update(row).eq("id", callId).select("*").maybeSingle();
  if (error) return { error: error.message };
  if (!call) return { error: "Not found." };
  // Newly linked: add it to the timeline (staff can't set transcripts; the text goes in the body).
  if (("contactId" in patch || "dealId" in patch) && !call.activity_id && (call.contact_id || call.deal_id)) {
    const { data: act } = await supabase.from("crm_activities").insert({
      kind: call.voicemail ? "voicemail" : "call", direction: call.direction, subject: call.voicemail ? "Voicemail" : "Call", status: call.status,
      body: call.transcript ?? call.notes ?? "", duration_seconds: call.duration_seconds, from_addr: call.from_number, to_addr: call.to_number,
      contact_id: call.contact_id, deal_id: call.deal_id, occurred_at: call.created_at,
    }).select("id").single();
    if (act) await supabase.from("phone_calls").update({ activity_id: act.id }).eq("id", callId);
  }
  await adminAudit(supabase, "comms.call.update", { type: "phone_call", id: callId }, { fields: Object.keys(row) });
  return done({ ok: "Saved." });
}
