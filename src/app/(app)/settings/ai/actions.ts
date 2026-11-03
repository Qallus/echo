"use server";

import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { decryptKey, encryptKey, last4 } from "@/lib/ai/keys";
import { MODELS, type ModelId } from "@/lib/ai/models";
import { buildWithKey } from "@/lib/ai/providers";
import { isUuid, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };
const isProvider = (p: string): p is ModelId => MODELS.some((m) => m.id === p);
const label = (p: ModelId) => MODELS.find((m) => m.id === p)!.label;

// A one-word request: proves the key (and model, if given) work.
async function check(provider: ModelId, key: string, model?: string | null): Promise<string | null> {
  try {
    await generateText({ model: buildWithKey(provider, key, model), prompt: "Reply with the single word: ok", maxOutputTokens: 50 });
    return null;
  } catch (e) {
    return (e instanceof Error ? e.message : String(e)).slice(0, 300);
  }
}

// Saves (or replaces) a key after testing it. scope "user" = your own key;
// "workspace" = a Business workspace's key (owners and admins; RLS checks).
export async function saveAiKey(input: { scope: "user" | "workspace"; workspaceId?: string; provider: string; key: string; model?: string }): Promise<Result> {
  const user = await requireUser();
  const key = input.key.trim();
  const model = input.model?.trim().slice(0, 100) || null;
  if (!isProvider(input.provider)) return { error: "Unknown provider." };
  if (key.length < 10 || key.length > 500 || /\s/.test(key)) return { error: "That doesn't look like an API key." };
  if (input.scope === "workspace" && !isUuid(input.workspaceId ?? "")) return { error: "Choose a workspace." };

  const problem = await check(input.provider, key, model);
  if (problem) return { error: `${label(input.provider)} rejected this key: ${problem}` };

  const supabase = await createClient();
  const owner = input.scope === "user" ? { user_id: user.id } : { workspace_id: input.workspaceId! };
  const existing = await supabase.from("ai_keys").select("id").eq("scope", input.scope).eq("provider", input.provider)
    .match(owner).maybeSingle();
  const row = { ciphertext: encryptKey(key), last4: last4(key), model, status: "ok", last_error: null, last_tested_at: new Date().toISOString() };
  const { error } = existing.data
    ? await supabase.from("ai_keys").update(row).eq("id", existing.data.id)
    : await supabase.from("ai_keys").insert({ ...row, scope: input.scope, provider: input.provider, ...owner });
  if (error) return { error: error.code === "42501" ? "Only workspace owners and admins can add team keys." : error.message };
  revalidatePath("/settings/ai");
  return { ok: `${label(input.provider)} key saved and working.` };
}

export async function testAiKey(id: string): Promise<Result> {
  await requireUser();
  if (!isUuid(id)) return { error: "Invalid key." };
  const supabase = await createClient();
  const { data } = await supabase.rpc("ai_key_for_test", { p_key: id }).maybeSingle<{ provider: ModelId; ciphertext: string; model: string | null }>();
  if (!data) return { error: "Key not found." };
  let plain: string;
  try { plain = decryptKey(data.ciphertext); } catch { return { error: "This key can't be read any more. Remove it and add it again." }; }
  const problem = await check(data.provider, plain, data.model);
  await supabase.from("ai_keys").update({ status: problem ? "failed" : "ok", last_error: problem, last_tested_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/settings/ai");
  return problem ? { error: `Not working: ${problem}` } : { ok: "Working." };
}

export async function setAiKeyModel(id: string, model: string): Promise<Result> {
  await requireUser();
  if (!isUuid(id)) return { error: "Invalid key." };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_keys").update({ model: model.trim().slice(0, 100) || null }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/ai");
  return { ok: "Model saved. Use Test to check it." };
}

export async function removeAiKey(id: string): Promise<Result> {
  await requireUser();
  if (!isUuid(id)) return { error: "Invalid key." };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_keys").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/ai");
  return { ok: "Key removed. Echo's own keys are used instead." };
}

export async function setAiKeyScope(workspaceId: string, scope: "workspace" | "member"): Promise<Result> {
  await requireUser();
  if (!isUuid(workspaceId)) return { error: "Invalid workspace." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ai_key_scope", { p_workspace: workspaceId, p_scope: scope });
  if (error) return { error: error.message };
  revalidatePath("/settings/ai");
  return { ok: scope === "workspace" ? "Everyone in this workspace now uses the team's keys." : "Each person now uses their own keys here." };
}
