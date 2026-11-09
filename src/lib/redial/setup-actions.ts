"use server";

import { revalidatePath } from "next/cache";
import { sendCode, verifyCode } from "@/app/(app)/settings/notifications/actions";
import { requireUser } from "@/lib/data";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { ANSWERS, LAST_STEP, stepAt } from "./setup";

type Result = { ok?: string; error?: string; channelId?: string; verified?: boolean };

// Save one step of the Redial setup wizard (validated), and move the saved
// position on. Step 1 also updates the profile: name, company, account type.
export async function saveSetupStep(n: number, values: unknown): Promise<Result> {
  const user = await requireUser();
  const step = stepAt(n);
  if (!step) return { error: "Unknown step." };
  const parsed = ANSWERS[step.key].safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your answers." };
  const supabase = await createClient();

  if (step.key === "about") {
    const a = ANSWERS.about.parse(values);
    const { data: phone } = await supabase.from("notification_channels").select("verified_at")
      .eq("user_id", user.id).eq("kind", "sms").eq("address", a.phone).maybeSingle();
    if (!phone?.verified_at) return { error: "Verify your mobile number first." };
    const { error } = await supabase.from("profiles").update({
      full_name: a.fullName, account_type: a.accountType, ...(a.accountType === "business" ? { company: a.company } : {}),
    }).eq("id", user.id);
    if (error) return { error: error.message };
    // Fill in profile fields that are still empty.
    await supabase.from("profiles").update({ phone: a.phone }).eq("id", user.id).is("phone", null);
    if (a.website) await supabase.from("profiles").update({ website: a.website }).eq("id", user.id).is("website", null);
  }

  const { data: row } = await supabase.from("redial_setups").select("step, answers").eq("user_id", user.id).maybeSingle();
  const next = Math.min(LAST_STEP, n + 1);
  const answers = { ...((row?.answers as Record<string, unknown>) ?? {}), [step.key]: parsed.data };
  const { error } = row
    ? await supabase.from("redial_setups").update({ answers, step: Math.max(row.step, next) }).eq("user_id", user.id)
    : await supabase.from("redial_setups").insert({ user_id: user.id, answers, step: next });
  if (error) return { error: error.message };
  revalidatePath("/setup", "layout");
  return { ok: "Saved." };
}

// Text a 6-digit code to a mobile number. It's kept as a text-message channel
// on the account, so once verified it can also get alerts.
export async function startPhoneCheck(raw: string): Promise<Result> {
  const user = await requireUser();
  const number = toE164(raw);
  if (!number) return { error: "Enter your full mobile number, e.g. (480) 555-0142." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("notification_channels").select("id, verified_at")
    .eq("user_id", user.id).eq("kind", "sms").eq("address", number).maybeSingle();
  if (existing?.verified_at) return { ok: "That number is already verified.", channelId: existing.id, verified: true };
  let id = existing?.id;
  if (!id) {
    const { data, error } = await supabase.from("notification_channels").insert({ user_id: user.id, kind: "sms", address: number }).select("id").single();
    if (error) return { error: error.message };
    id = data.id as string;
  }
  const sent = await sendCode(id);
  return { ...sent, channelId: id };
}

export async function confirmPhoneCheck(channelId: string, code: string): Promise<Result> {
  const res = await verifyCode(channelId, code);
  return res.ok ? { ok: "Verified.", channelId, verified: true } : res;
}
