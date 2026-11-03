"use server";

import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { decryptKey, encryptKey, last4 } from "@/lib/ai/keys";
import { MODELS } from "@/lib/ai/models";
import { buildCustom } from "@/lib/ai/providers";
import { getAiSettings, parseAiSettings, type AiSettings } from "@/lib/ai/settings";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };

// Enabled providers, default chat model, summary fallback order, Echo's model
// per provider and the price table.
export async function saveAiSettings(input: AiSettings): Promise<Result> {
  await requireStaff("ai.manage");
  const next = parseAiSettings(input);
  if (!next.enabled.length) return { error: "Enable at least one provider." };
  if (!next.enabled.includes(next.defaultChat)) return { error: "The default chat model must be enabled." };
  const models = Object.fromEntries(Object.entries(next.models).filter(([id, m]) => MODELS.some((x) => x.id === id) && typeof m === "string" && m.trim()).map(([id, m]) => [id, (m as string).trim().slice(0, 100)]));
  const supabase = await createClient();
  const before = await getAiSettings(supabase);
  const { error } = await supabase.from("platform_settings").upsert({ key: "ai", value: { ...next, models } }, { onConflict: "key" });
  if (error) return { error: error.message };
  await adminAudit(supabase, "ai.settings.save", { type: "setting", id: "ai" }, { from: before, to: { ...next, models } });
  revalidatePath("/admin/ai");
  return { ok: "Saved. New requests use these settings." };
}

async function testEndpoint(baseUrl: string, key: string | null, model: string): Promise<string | null> {
  try {
    await generateText({ model: buildCustom(baseUrl, key, model), prompt: "Reply with the single word: ok", maxOutputTokens: 50 });
    return null;
  } catch (e) {
    return (e instanceof Error ? e.message : String(e)).slice(0, 300);
  }
}

// A custom OpenAI-compatible provider (e.g. Ollama on your server: base URL
// http://your-server:11434/v1, model "llama3.3"). Tested before it's saved.
export async function addCustomProvider(input: { name: string; baseUrl: string; key?: string; model: string }): Promise<Result> {
  await requireStaff("ai.manage");
  const name = input.name.trim().slice(0, 60);
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const model = input.model.trim().slice(0, 100);
  const key = input.key?.trim() || null;
  if (!name || !model) return { error: "Give it a name and a model." };
  if (!/^https?:\/\/[^\s]+$/.test(baseUrl) || baseUrl.length > 300) return { error: "Enter the base URL, e.g. https://ai.example.com/v1" };
  const problem = await testEndpoint(baseUrl, key, model);
  if (problem) return { error: `The endpoint didn't answer: ${problem}` };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_custom_providers")
    .insert({ name, base_url: baseUrl, model, ciphertext: key ? encryptKey(key) : null, last4: key ? last4(key) : null })
    .select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, "ai.custom_provider.add", { type: "ai_provider", id: data.id }, { name, base_url: baseUrl, model });
  revalidatePath("/admin/ai");
  return { ok: `${name} added. Customers can now pick it in Ask Echo.` };
}

export async function setCustomProviderEnabled(id: string, enabled: boolean): Promise<Result> {
  await requireStaff("ai.manage");
  if (!isUuid(id)) return { error: "Invalid provider." };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_custom_providers").update({ enabled }).eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, enabled ? "ai.custom_provider.enable" : "ai.custom_provider.disable", { type: "ai_provider", id });
  revalidatePath("/admin/ai");
  return { ok: enabled ? "Enabled." : "Disabled." };
}

export async function testCustomProvider(id: string): Promise<Result> {
  await requireStaff("ai.manage");
  if (!isUuid(id)) return { error: "Invalid provider." };
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_custom_provider", { p_id: id })
    .maybeSingle<{ base_url: string; ciphertext: string | null; model: string }>();
  if (!data) return { error: "Provider not found." };
  const problem = await testEndpoint(data.base_url, data.ciphertext ? decryptKey(data.ciphertext) : null, data.model);
  return problem ? { error: `Not answering: ${problem}` } : { ok: "Working." };
}

export async function removeCustomProvider(id: string): Promise<Result> {
  await requireStaff("ai.manage");
  if (!isUuid(id)) return { error: "Invalid provider." };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_custom_providers").delete().eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "ai.custom_provider.remove", { type: "ai_provider", id });
  revalidatePath("/admin/ai");
  return { ok: "Removed." };
}
