"use server";

import { revalidatePath } from "next/cache";
import { twilioRequest } from "@/lib/comms/twilio";
import { requireUser } from "@/lib/data";
import { siteUrl, toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { lineNumber } from "./server";

// Member actions for the Echo call line. Data writes run as the member (RLS);
// Twilio is called with Echo's account. Only Twilio's signed callback marks a
// number verified.

type Result = { ok?: string; error?: string; code?: string };
const done = (r: Result): Result => { revalidatePath("/phone"); return r; };

// Saves the member's cell and starts Twilio's caller-ID check: Twilio calls
// the number and asks for the code we show on screen.
export async function verifyPhone(raw: string): Promise<Result> {
  const user = await requireUser();
  const number = toE164(raw);
  if (!number) return { error: "Enter your cell number, e.g. (480) 555-0142." };
  const line = await lineNumber();
  if (!line) return { error: "The Echo call line isn't set up yet." };
  if (number === line) return { error: "That's the Echo line itself. Use your own cell." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("call_line_phones").select("number").eq("user_id", user.id).maybeSingle();
  const saved = existing
    ? await supabase.from("call_line_phones").update({ number }).eq("user_id", user.id)
    : await supabase.from("call_line_phones").insert({ user_id: user.id, number });
  if (saved.error) return { error: saved.error.code === "23505" ? "Another Echo account uses that number." : saved.error.message };

  // Twilio refuses to re-check a number it already has; remove the old entry first.
  const listed = await twilioRequest("/OutgoingCallerIds.json", { PhoneNumber: number }, "GET");
  for (const c of ((listed.data.outgoing_caller_ids ?? []) as { sid: string }[])) await twilioRequest(`/OutgoingCallerIds/${c.sid}.json`, {}, "DELETE");
  const res = await twilioRequest("/OutgoingCallerIds.json", {
    PhoneNumber: number, FriendlyName: `Echo ${user.id.slice(0, 8)}`, CallDelay: "3",
    StatusCallback: siteUrl(`/api/webhooks/twilio/line/caller-id?user=${user.id}`),
  });
  if (!res.ok) return { error: String(res.data.message ?? "Twilio couldn't start the check.") };
  const code = String(res.data.validation_code ?? "");
  await supabase.from("call_line_phones").update({ validation_code: code }).eq("user_id", user.id);
  return done({ ok: "Twilio is calling you now. Enter the code when asked.", code });
}

export async function saveLinePrefs(prefs: { workspaceId: string | null; askWorkspace: boolean; announce: boolean }): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("call_line_phones")
    .update({ workspace_id: prefs.workspaceId, ask_workspace: prefs.askWorkspace, announce: prefs.announce }).eq("user_id", user.id);
  return error ? { error: error.message } : done({ ok: "Saved." });
}

export async function removePhone(): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("call_line_phones").delete().eq("user_id", user.id);
  return error ? { error: error.message } : done({ ok: "Removed." });
}

// "Call & record": Echo rings the member first; when they press 1 it dials
// the other person showing the member's own (verified) number.
export async function placeLineCall(rawTo: string, workspaceId: string | null): Promise<Result> {
  const user = await requireUser();
  const to = toE164(rawTo);
  if (!to) return { error: "Enter a valid phone number." };
  const line = await lineNumber();
  if (!line) return { error: "The Echo call line isn't set up yet." };
  const supabase = await createClient();
  const { data: phone } = await supabase.from("call_line_phones").select("number, status").eq("user_id", user.id).maybeSingle();
  if (phone?.status !== "verified") return { error: "Verify your cell number first." };
  if (to === phone.number || to === line) return { error: "Enter the number of the person you're calling." };

  const { data: call, error } = await supabase.from("call_line_calls").insert({ user_id: user.id, kind: "outbound", to_number: to, workspace_id: workspaceId }).select("id").single();
  if (error || !call) return { error: error?.message ?? "Couldn't start the call." };
  const res = await twilioRequest("/Calls.json", {
    To: phone.number, From: line, Timeout: "25",
    Url: siteUrl(`/api/webhooks/twilio/line/outbound?call=${call.id}`),
    StatusCallback: siteUrl(`/api/webhooks/twilio/line/status?call=${call.id}`),
  });
  if (!res.ok) {
    const message = String(res.data.message ?? "Twilio couldn't place the call.").slice(0, 300);
    await supabase.from("call_line_calls").update({ status: "failed", error: message }).eq("id", call.id);
    return done({ error: message });
  }
  return done({ ok: "Calling your phone now. Answer and press 1 to connect." });
}
