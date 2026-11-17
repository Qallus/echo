"use server";

import { revalidatePath } from "next/cache";
import { encryptKey } from "@/lib/ai/keys";
import { twilioSms } from "@/lib/comms/twilio";
import { getMyProfile, requireUser } from "@/lib/data";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// Fraud protection settings for a line's owner (Calls -> Protection). Runs as
// the signed-in member; RLS limits every change to lines they own. The code
// word is encrypted here and never sent back to the browser.

type Result = { ok?: string; error?: string };
const done = (ok: string): Result => { revalidatePath("/calls"); return { ok }; };
const denied = "Only the line's owner can change its protection.";
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function saveProtection(lineId: string, patch: { enabled?: boolean; auto_block_scams?: boolean; warn_on_courier?: boolean }): Promise<Result> {
  await requireUser();
  const row = Object.fromEntries(Object.entries(patch).filter(([, v]) => typeof v === "boolean"));
  if (!Object.keys(row).length) return { error: "Nothing to change." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("redial_protection").upsert({ line_id: lineId, ...row }, { onConflict: "line_id" }).select("line_id").maybeSingle();
  if (error) return { error: error.code === "42501" ? denied : error.message };
  if (!data) return { error: denied };
  return done("Saved.");
}

// "" removes the code word.
export async function setCodeWord(lineId: string, word: string): Promise<Result> {
  await requireUser();
  const w = word.trim();
  if (w && (w.length < 2 || w.length > 40)) return { error: "Use 2 to 40 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("redial_protection")
    .upsert({ line_id: lineId, code_word_cipher: w ? encryptKey(w) : null }, { onConflict: "line_id" }).select("line_id").maybeSingle();
  if (error) return { error: error.code === "42501" ? denied : error.message };
  if (!data) return { error: denied };
  return done(w ? "Code word saved." : "Code word removed.");
}

export type FamilyInput = { name: string; relationship: string; phone: string; callback_ok: boolean };
export async function saveFamilyMember(lineId: string, id: string | null, input: FamilyInput): Promise<Result> {
  await requireUser();
  const name = text(input.name, 80);
  if (!name) return { error: "Enter their name." };
  const phone = input.phone.trim() ? toE164(input.phone) : null;
  if (input.phone.trim() && !phone) return { error: "Enter their full phone number, e.g. (480) 555-0142." };
  const row = { name, relationship: text(input.relationship, 40) || null, phone, callback_ok: Boolean(input.callback_ok) };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from("redial_family").update(row, { count: "exact" }).eq("id", id)
    : await supabase.from("redial_family").insert({ ...row, line_id: lineId }, { count: "exact" });
  if (error) return { error: error.code === "42501" ? denied : error.message };
  return count ? done(id ? "Saved." : `${name} added.`) : { error: denied };
}

export async function removeFamilyMember(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error, count } = await supabase.from("redial_family").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  return count ? done("Removed.") : { error: denied };
}

export type TrustedInput = { name: string; phone: string; email: string; alert_scams: boolean; weekly_summary: boolean };
export async function saveTrustedContact(lineId: string, id: string | null, input: TrustedInput): Promise<Result> {
  await requireUser();
  const name = text(input.name, 80);
  if (!name) return { error: "Enter their name." };
  const phone = input.phone.trim() ? toE164(input.phone) : null;
  if (input.phone.trim() && !phone) return { error: "Enter their full phone number, e.g. (480) 555-0142." };
  const email = text(input.email, 200).toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That email address doesn't look right." };
  if (!phone && !email) return { error: "Add a mobile number or an email so they can be reached." };
  const row = { name, phone, email, alert_scams: Boolean(input.alert_scams), weekly_summary: Boolean(input.weekly_summary) };
  const supabase = await createClient();
  const { error, count } = id
    ? await supabase.from("redial_trusted_contacts").update(row, { count: "exact" }).eq("id", id)
    : await supabase.from("redial_trusted_contacts").insert({ ...row, line_id: lineId }, { count: "exact" });
  if (error) return { error: error.code === "42501" ? denied : error.message };
  return count ? done(id ? "Saved." : `${name} added.${phone ? " Send them the invite text so they can opt in." : ""}`) : { error: denied };
}

export async function removeTrustedContact(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error, count } = await supabase.from("redial_trusted_contacts").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  return count ? done("Removed.") : { error: denied };
}

// The opt-in text. They reply YES (handled by the inbound text webhook) to
// get alerts; they choose how often by what they turn on, never a fixed count.
export async function inviteTrustedContact(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("redial_trusted_invite", { p_id: id });
  if (error) return { error: error.message };
  const reasons: Record<string, string> = {
    not_found: denied, no_phone: "Add their mobile number first.", consented: "They already said yes.",
    opted_out: "They replied STOP, so they can't be texted. They can text START, then YES, to Echo's number.",
    too_soon: "They were invited in the last day. Give them a little time to reply.",
  };
  if (status !== "ok") return { error: reasons[String(status)] ?? "Couldn't send the invite." };
  const { data: t } = await supabase.from("redial_trusted_contacts").select("name, phone").eq("id", id).maybeSingle();
  const me = (await getMyProfile()).fullName?.trim() || "someone you know";
  const res = await twilioSms(t!.phone!, `${me} added you as a trusted contact on Redial, their call assistant. Redial can text you if it stops a likely scam call to them. Reply YES to get these alerts. Reply STOP to opt out.`);
  if (!res.ok) return { error: `The text didn't send: ${res.error ?? "unknown error"}` };
  return done(`Invite sent to ${t!.name}. They'll start getting alerts after they reply YES.`);
}
