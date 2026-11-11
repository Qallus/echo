"use server";

import { revalidatePath } from "next/cache";
import { sendCode, verifyCode } from "@/app/(app)/settings/notifications/actions";
import { startCheckout } from "@/lib/billing/actions";
import { findPrice, lineOf } from "@/lib/billing/catalog";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { requireUser } from "@/lib/data";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { ANSWERS, LAST_STEP, setupGreeting, stepAt, type SetupAnswers } from "./setup";

type Result = { ok?: string; error?: string; channelId?: string; verified?: boolean; url?: string };

// Save one step of the Redial setup wizard (validated), and move the saved
// position on. Some steps also update other settings: step 1 the profile,
// step 6 the alerts for screened calls.
export async function saveSetupStep(n: number, values: unknown): Promise<Result> {
  const user = await requireUser();
  const step = stepAt(n);
  if (!step || step.key === "review") return { error: "Unknown step." };
  const parsed = ANSWERS[step.key].safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your answers." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("redial_setups").select("step, answers").eq("user_id", user.id).maybeSingle();
  const saved = (row?.answers ?? {}) as SetupAnswers;
  let data: Record<string, unknown> = parsed.data;

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

  if (step.key === "assistant") {
    const a = ANSWERS.assistant.parse(values);
    // No greeting written: if they chose to say the assistant is an AI, keep a greeting that does.
    if (!a.greeting && a.disclose) data = { ...a, greeting: setupGreeting(a.name, (saved.about?.fullName ?? "").split(" ")[0], true) };
  }

  if (step.key === "after") {
    const a = ANSWERS.after.parse(values);
    const forwarding = saved.route?.method === "missed" || saved.route?.method === "all";
    if (a.forwardTo && forwarding && a.forwardTo === saved.about?.phone) {
      return { error: "That's the phone that forwards to Redial, so ringing it would loop. Use another number, or leave it empty and take calls in the Redial app." };
    }
    // Alerts for screened calls (notification type redial_call).
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id, type: "redial_call", in_app: true, email: a.alerts.email, sms: a.alerts.sms, push: a.alerts.push,
    });
    if (error) return { error: error.message };
  }

  if (step.key === "plan") {
    const a = ANSWERS.plan.parse(values);
    if (a.priceKey) {
      await loadCatalog();
      const hit = findPrice(a.priceKey);
      if (hit?.product.kind !== "plan" || lineOf(hit.product) !== "redial") return { error: "Pick one of the Redial plans." };
    }
  }

  const next = Math.min(LAST_STEP, n + 1);
  const answers = { ...saved, [step.key]: data };
  const { error } = row
    ? await supabase.from("redial_setups").update({ answers, step: Math.max(row.step, next) }).eq("user_id", user.id)
    : await supabase.from("redial_setups").insert({ user_id: user.id, answers, step: next });
  if (error) return { error: error.message };
  revalidatePath("/setup", "layout");
  return { ok: "Saved." };
}

// Step 8: agree, submit (adds them to the CRM for follow-up), then checkout
// if they picked a paid plan.
export async function finishSetup(values: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = ANSWERS.review.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your answers." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("redial_setups").select("answers").eq("user_id", user.id).maybeSingle();
  if (!row) return { error: "Start with the first step." };
  const answers = { ...(row.answers as SetupAnswers), review: parsed.data };
  const { error } = await supabase.from("redial_setups").update({ answers }).eq("user_id", user.id);
  if (error) return { error: error.message };
  const { error: submitError } = await supabase.rpc("redial_setup_submit");
  if (submitError) return { error: submitError.message };
  revalidatePath("/", "layout");

  const plan = answers.plan;
  if (plan?.priceKey) {
    const res = await startCheckout([{ key: plan.priceKey, quantity: plan.quantity ?? 1 }]);
    if (res.url) return { url: res.url };
    // Saved either way; the plan can be bought from Pricing.
    return { ok: `Your setup is saved. ${res.error ?? "Checkout couldn't start."} You can choose a plan from Pricing any time.` };
  }
  return { ok: "Your setup is saved." };
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
