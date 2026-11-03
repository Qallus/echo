import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { MODELS, type ModelId } from "@/lib/ai/models";
import { secret, secrets } from "@/lib/secrets";
import { decryptKey } from "./keys";
import { estimateCost, getAiSettings, type AiSettings } from "./settings";

// Each provider: which env var holds Echo's key, its default model (override
// with the *_MODEL env var or Super Admin), and how to build the SDK model.
// `extra` carries settings that go with Echo's own key (the Anthropic workspace).
const PROVIDERS: Record<ModelId, { keyEnv: string; modelEnv: string; defaultModel: string; build: (key: string, model: string, extra?: Record<string, string | undefined>) => LanguageModel }> = {
  claude: {
    keyEnv: "ANTHROPIC_API_KEY", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-sonnet-5-5",
    // Echo's key isn't scoped to a workspace, so it names one (ANTHROPIC_WORKSPACE_ID).
    build: (apiKey, model, extra) => createAnthropic({
      apiKey,
      headers: extra?.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": extra.ANTHROPIC_WORKSPACE_ID } : undefined,
    })(model),
  },
  gpt: {
    keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-6.1-sol",
    build: (apiKey, model) => createOpenAI({ apiKey })(model),
  },
  gemini: {
    // Google's OpenAI-compatible endpoint (no trailing slash: it 404s).
    keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-flash-latest",
    build: (apiKey, model) =>
      createOpenAI({ apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai" }).chat(model),
  },
  grok: {
    keyEnv: "XAI_API_KEY", modelEnv: "XAI_MODEL", defaultModel: "grok-4.7",
    build: (apiKey, model) => createXai({ apiKey })(model),
  },
  kimi: {
    // Moonshot exposes an OpenAI-compatible Chat Completions API.
    keyEnv: "MOONSHOT_API_KEY", modelEnv: "MOONSHOT_MODEL", defaultModel: "kimi-k3",
    build: (apiKey, model) =>
      createOpenAI({ apiKey, baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1" }).chat(model),
  },
  openrouter: {
    // One key, many models. "openrouter/auto" picks one per request; set
    // OPENROUTER_MODEL (e.g. "anthropic/claude-sonnet-5-5") to pin one.
    keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "openrouter/auto",
    build: (apiKey, model) => createOpenAI({
      apiKey, baseURL: "https://openrouter.ai/api/v1",
      headers: { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://echo.redial.si", "X-Title": "Echo" },
    }).chat(model),
  },
};

const LABELS = Object.fromEntries(MODELS.map((m) => [m.id, m.label])) as Record<ModelId, string>;
const isBuiltIn = (id: string): id is ModelId => id in PROVIDERS;

// A model choice: a built-in provider, or "custom:<id>" for a Super Admin custom provider.
export type ModelChoice = ModelId | `custom:${string}`;
export const isModelChoice = (v: unknown): v is ModelChoice =>
  typeof v === "string" && (isBuiltIn(v) || /^custom:[0-9a-f-]{36}$/i.test(v));

export type KeySource = "own" | "echo" | "custom";
export type Resolved = { model: LanguageModel; label: string; provider: string; modelName: string; keySource: KeySource; keyId?: string };

// Echo's own key is configured for this provider (Integrations or Coolify).
export async function isConfigured(id: ModelId) {
  return Boolean(await secret(PROVIDERS[id].keyEnv));
}

export async function configuredProviders(): Promise<Record<ModelId, boolean>> {
  const keys = await secrets(...MODELS.map((m) => PROVIDERS[m.id].keyEnv));
  return Object.fromEntries(MODELS.map((m) => [m.id, Boolean(keys[PROVIDERS[m.id].keyEnv])])) as Record<ModelId, boolean>;
}

export const echoModelName = (id: ModelId, settings: AiSettings) =>
  settings.models[id] || process.env[PROVIDERS[id].modelEnv] || PROVIDERS[id].defaultModel;

export type CustomerKey = { id: string; provider: ModelId; ciphertext: string; model: string | null; status: string };

// The keys this user's requests should use in this workspace (or their own
// keys when no workspace applies). Empty if the server can't decrypt.
export async function customerKeys(supabase: SupabaseClient, workspaceId?: string | null): Promise<CustomerKey[]> {
  const { data } = await supabase.rpc("resolve_ai_keys", { p_workspace: workspaceId ?? null });
  return (data ?? []) as CustomerKey[];
}

// What to try, in order, for one choice: the customer's own key (if they have
// one), then Echo's key. A custom provider is used on its own.
export async function resolveCandidates(
  supabase: SupabaseClient,
  choice: ModelChoice,
  opts: { workspaceId?: string | null; settings?: AiSettings; keys?: CustomerKey[] } = {},
): Promise<Resolved[]> {
  const settings = opts.settings ?? (await getAiSettings(supabase));
  if (choice.startsWith("custom:")) {
    const { data } = await supabase.rpc("resolve_custom_provider", { p_id: choice.slice(7) })
      .maybeSingle<{ id: string; name: string; base_url: string; ciphertext: string | null; model: string }>();
    if (!data) return [];
    const apiKey = data.ciphertext ? decryptKey(data.ciphertext) : "not-needed";
    return [{ model: createOpenAI({ apiKey, baseURL: data.base_url }).chat(data.model), label: data.name, provider: `custom:${data.id}`, modelName: data.model, keySource: "custom" }];
  }

  const id = choice as ModelId;
  const p = PROVIDERS[id];
  const out: Resolved[] = [];
  const own = (opts.keys ?? (await customerKeys(supabase, opts.workspaceId))).find((k) => k.provider === id);
  if (own) {
    try {
      const modelName = own.model || echoModelName(id, settings);
      out.push({ model: p.build(decryptKey(own.ciphertext), modelName), label: LABELS[id], provider: id, modelName, keySource: "own", keyId: own.id });
    } catch (e) {
      console.error(`[ai] couldn't decrypt ${id} key ${own.id}:`, e instanceof Error ? e.message : e);
    }
  }
  const conf = await secrets(p.keyEnv, "ANTHROPIC_WORKSPACE_ID");
  const echoKey = conf[p.keyEnv];
  if (echoKey && settings.enabled.includes(id)) {
    const modelName = echoModelName(id, settings);
    out.push({ model: p.build(echoKey, modelName, conf), label: LABELS[id], provider: id, modelName, keySource: "echo" });
  }
  return out;
}

// A customer key failed: mark it and notify its owner (at most once a day).
export async function reportKeyFailure(supabase: SupabaseClient, keyId: string, error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  await supabase.rpc("report_ai_key_failure", { p_key: keyId, p_error: message });
}

export type UsageRow = {
  workspaceId?: string | null; feature: "chat" | "summary" | "transcription" | "mcp" | "test";
  resolved: Pick<Resolved, "provider" | "modelName" | "keySource">; fallback?: boolean;
  inputTokens?: number; outputTokens?: number; audioSeconds?: number; ok?: boolean; latencyMs?: number; error?: string;
  settings?: AiSettings;
};

// One ai_usage row per AI call (never throws: usage logging mustn't break a request).
export async function logUsage(supabase: SupabaseClient, u: UsageRow) {
  try {
    const settings = u.settings ?? (await getAiSettings(supabase));
    const cost = u.audioSeconds != null
      ? (u.audioSeconds / 60) * settings.transcriptionCentsPerMinute
      : estimateCost(settings, u.resolved.modelName, u.inputTokens, u.outputTokens);
    const { error } = await supabase.from("ai_usage").insert({
      workspace_id: u.workspaceId ?? null, feature: u.feature, provider: u.resolved.provider, model: u.resolved.modelName,
      key_source: u.resolved.keySource, fallback: u.fallback ?? false,
      input_tokens: u.inputTokens ?? null, output_tokens: u.outputTokens ?? null, audio_seconds: u.audioSeconds ?? null,
      cost_cents: cost, ok: u.ok ?? true, latency_ms: u.latencyMs ?? null, error: u.error?.slice(0, 500) ?? null,
    });
    if (error) console.error("[ai usage]", error.message);
  } catch (e) {
    console.error("[ai usage]", e instanceof Error ? e.message : e);
  }
}

// For the settings "Test" button: builds a model from a raw key.
export function buildWithKey(id: ModelId, apiKey: string, modelName?: string | null) {
  const p = PROVIDERS[id];
  return p.build(apiKey, modelName || p.defaultModel);
}

export function buildCustom(baseURL: string, apiKey: string | null, model: string) {
  return createOpenAI({ apiKey: apiKey || "not-needed", baseURL }).chat(model);
}
