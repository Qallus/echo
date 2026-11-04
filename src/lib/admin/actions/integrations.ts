"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { encryptKey, last4 } from "@/lib/ai/keys";
import { SERVICES, fieldFor } from "@/lib/integrations";
import { invalidateSecrets, secrets } from "@/lib/secrets";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };

// Admin -> Settings -> Integrations (settings.manage: owners and admins).
// Values are encrypted before they're stored; the audit log records which
// keys changed, never the values.

const done = (r: Result): Result => { invalidateSecrets(); revalidatePath("/admin", "layout"); return r; };

// Insert-or-update goes through public.admin_save_secret: a direct upsert
// would need read access to the encrypted column, which the API never has.
const saveSecret = (supabase: Awaited<ReturnType<typeof createClient>>, key: string, ciphertext: string, hint: string) =>
  supabase.rpc("admin_save_secret", { p_key: key, p_ciphertext: ciphertext, p_hint: hint });

// Saves the filled-in fields of one service. Blank fields are left as they are.
export async function saveIntegration(serviceId: string, values: Record<string, string>): Promise<Result> {
  await requireStaff("settings.manage");
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return { error: "Unknown service." };
  const rows = service.fields.flatMap((f) => {
    const v = (values[f.key] ?? "").trim();
    if (!v) return [];
    return [{ key: f.key, ciphertext: encryptKey(v.slice(0, 4000)), hint: f.secret ? `••••${last4(v)}` : v.slice(0, 200) }];
  });
  if (!rows.length) return { error: "Nothing to save. Fill in at least one field." };
  const supabase = await createClient();
  for (const r of rows) {
    const { error } = await saveSecret(supabase, r.key, r.ciphertext, r.hint);
    if (error) return { error: error.message };
  }
  await adminAudit(supabase, "integrations.save", { type: "integration", id: serviceId }, { keys: rows.map((r) => r.key) });
  return done({ ok: `${service.name} saved. In use within a minute.` });
}

export async function clearIntegrationKey(key: string): Promise<Result> {
  await requireStaff("settings.manage");
  if (!fieldFor(key)) return { error: "Unknown setting." };
  const supabase = await createClient();
  const { error } = await supabase.from("platform_secrets").delete().eq("key", key);
  if (error) return { error: error.message };
  await adminAudit(supabase, "integrations.clear", { type: "integration", id: key });
  return done({ ok: "Cleared. Coolify's value is used if it has one." });
}

// A new random cron secret, saved and returned once so it can be pasted into
// the Coolify scheduled task.
export async function generateCronSecret(): Promise<Result & { value?: string }> {
  await requireStaff("settings.manage");
  const value = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  const { error } = await saveSecret(supabase, "CRON_SECRET", encryptKey(value), `••••${last4(value)}`);
  if (error) return { error: error.message };
  await adminAudit(supabase, "integrations.cron.generate", { type: "integration", id: "CRON_SECRET" });
  done({});
  return { ok: "New secret saved. Copy it into the Coolify scheduled task now; it won't be shown again.", value };
}

const get = async (url: string, headers: Record<string, string>) => {
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } | string } | null;
    const msg = typeof body?.error === "string" ? body.error : body?.error?.message ?? body?.message;
    return `${res.status}${msg ? `: ${msg}` : ""}`;
  } catch (e) {
    return e instanceof Error ? e.message : "Couldn't reach the service.";
  }
};
const bearer = (k: string) => ({ Authorization: `Bearer ${k}` });

// Checks the saved (or Coolify) credentials with the provider. Read-only calls.
export async function testIntegration(serviceId: string): Promise<Result> {
  await requireStaff("settings.manage");
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service?.testable) return { error: "This one can't be tested yet." };
  const v = await secrets(...service.fields.map((f) => f.key));
  const missing = service.fields.filter((f) => f.required && !v[f.key]).map((f) => f.label);
  if (missing.length) return { error: `Missing: ${missing.join(", ")}.` };
  let problem: string | null = null;
  switch (serviceId) {
    case "twilio": {
      const auth = { Authorization: `Basic ${Buffer.from(`${v.TWILIO_ACCOUNT_SID}:${v.TWILIO_AUTH_TOKEN}`).toString("base64")}` };
      problem = await get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.TWILIO_ACCOUNT_SID!)}.json`, auth);
      if (!problem && v.TWILIO_API_KEY_SID && v.TWILIO_API_KEY_SECRET) {
        const keyAuth = { Authorization: `Basic ${Buffer.from(`${v.TWILIO_API_KEY_SID}:${v.TWILIO_API_KEY_SECRET}`).toString("base64")}` };
        const p = await get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.TWILIO_ACCOUNT_SID!)}.json`, keyAuth);
        if (p) problem = `Account works, but the API key didn't (${p}).`;
      }
      if (!problem && v.TWILIO_TWIML_APP_SID) {
        const p = await get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.TWILIO_ACCOUNT_SID!)}/Applications/${encodeURIComponent(v.TWILIO_TWIML_APP_SID)}.json`, auth);
        if (p) problem = `Account works, but the TwiML App wasn't found (${p}).`;
      }
      break;
    }
    case "resend": problem = await get("https://api.resend.com/domains", bearer(v.RESEND_API_KEY!)); break;
    case "stripe": problem = await get("https://api.stripe.com/v1/balance", bearer(v.STRIPE_SECRET_KEY!)); break;
    case "openai": problem = await get("https://api.openai.com/v1/models", bearer(v.OPENAI_API_KEY!)); break;
    case "anthropic": problem = await get("https://api.anthropic.com/v1/models", { "x-api-key": v.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" }); break;
    case "xai": problem = await get("https://api.x.ai/v1/models", bearer(v.XAI_API_KEY!)); break;
    case "gemini": problem = await get("https://generativelanguage.googleapis.com/v1beta/openai/models", bearer(v.GEMINI_API_KEY!)); break;
    case "openrouter": problem = await get("https://openrouter.ai/api/v1/key", bearer(v.OPENROUTER_API_KEY!)); break;
    case "moonshot": problem = await get(`${process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1"}/models`, bearer(v.MOONSHOT_API_KEY!)); break;
  }
  const supabase = await createClient();
  await adminAudit(supabase, "integrations.test", { type: "integration", id: serviceId }, { ok: !problem });
  return problem ? { error: `${service.name} said no: ${problem}` } : { ok: `${service.name} is connected.` };
}
