"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { encryptKey } from "@/lib/ai/keys";
import { ensureSipDomain, sipConfig } from "@/lib/comms/sip";
import { toE164 } from "@/lib/notify/senders";
import { invalidateSecrets, secret } from "@/lib/secrets";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };

// Gives a member a Redial line on one of Echo's Twilio numbers. The number's
// webhooks must point at /api/webhooks/twilio/redial/voice and .../status.
export async function assignRedialLine(email: string, rawNumber: string, label: string): Promise<Result> {
  await requireStaff("users.manage");
  const number = toE164(rawNumber);
  if (!number) return { error: "Enter the Twilio number in full, e.g. +1 480 555 0100." };
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { error: "Enter the member's email." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_redial_assign", { p_email: email.trim(), p_number: number, p_label: label.trim() });
  if (error) return { error: error.code === "23505" ? "That number is already assigned." : error.message };
  await adminAudit(supabase, "redial.line.assign", { type: "redial_line", id: data as string }, { email: email.trim().toLowerCase(), number });
  revalidatePath("/admin/redial");
  return { ok: "Line assigned. Their setup answers were applied, and they see Calls in their sidebar." };
}

export async function removeRedialLine(id: string): Promise<Result> {
  await requireStaff("users.manage");
  const supabase = await createClient();
  const { error, count } = await supabase.from("redial_lines").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Line not found." };
  await adminAudit(supabase, "redial.line.remove", { type: "redial_line", id });
  revalidatePath("/admin/redial");
  return { ok: "Line removed, with its call history." };
}

// Conference routing for one line: screened calls run as a conference with
// the AI as its own participant (needs REDIAL_AI_APP_SID). Off by default.
export async function setRedialRouting(id: string, on: boolean): Promise<Result> {
  await requireStaff("users.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_redial_set_routing", { p_line: id, p_on: on });
  if (error) return { error: error.message };
  await adminAudit(supabase, "redial.line.routing", { type: "redial_line", id }, { live_routing: on });
  revalidatePath("/admin/redial");
  return { ok: on ? "Conference routing on." : "Conference routing off." };
}

// Setup requests: ask the member for more information (they see the note),
// or put it back in the queue. Assigning a number makes it active.
export async function setRedialSetupStatus(userId: string, status: "needs_info" | "submitted", note: string): Promise<Result> {
  await requireStaff("users.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_redial_setup_status", { p_user: userId, p_status: status, p_note: note });
  if (error) return { error: error.message };
  revalidatePath("/admin/redial");
  return { ok: status === "needs_info" ? "Sent back to the member with your note." : "Back in the queue." };
}

// Creates (or repairs) the Twilio SIP domain desk phones sign in to, and
// saves its IDs in Settings > Integrations (settings.manage: it writes keys).
export async function setUpSipDomain(): Promise<Result> {
  await requireStaff("settings.manage");
  const accountSid = await secret("TWILIO_ACCOUNT_SID");
  if (!accountSid) return { error: "Add the Twilio account in Settings → Integrations first." };
  const r = await ensureSipDomain(await sipConfig(), accountSid);
  if (!r.config) return { error: r.error };
  const supabase = await createClient();
  for (const [key, value] of [["TWILIO_SIP_DOMAIN", r.config.domain], ["TWILIO_SIP_DOMAIN_SID", r.config.domainSid], ["TWILIO_SIP_CREDENTIAL_LIST_SID", r.config.listSid]] as const) {
    const { error } = await supabase.rpc("admin_save_secret", { p_key: key, p_ciphertext: encryptKey(value), p_hint: value.slice(0, 200) });
    if (error) return { error: error.message };
  }
  invalidateSecrets();
  await adminAudit(supabase, "redial.sip.setup", { type: "integration", id: "twilio" }, { domain: r.config.domain });
  revalidatePath("/admin/redial");
  return { ok: `Desk phones are set up on ${r.config.domain}.` };
}
