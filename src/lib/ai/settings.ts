import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, type ModelId } from "./models";

// Super Admin AI settings, stored in platform_settings under "ai".
// Prices are US cents per million tokens (input/output); transcription is
// cents per minute. They feed the cost estimates in ai_usage.

export type AiSettings = {
  enabled: ModelId[]; // which built-in providers customers can pick
  defaultChat: ModelId;
  summaryOrder: ModelId[]; // fallback order for summaries
  models: Partial<Record<ModelId, string>>; // Echo's model per provider (overrides env/defaults)
  prices: Record<string, { input: number; output: number }>; // by model name
  transcriptionCentsPerMinute: number;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: MODELS.map((m) => m.id),
  defaultChat: "claude",
  summaryOrder: ["claude", "gpt", "gemini", "grok", "openrouter"],
  models: {},
  prices: {
    "claude-sonnet-5-5": { input: 300, output: 1500 },
    "gpt-6.1-sol": { input: 250, output: 1000 },
    "gemini-flash-latest": { input: 30, output: 250 },
    "grok-4.7": { input: 300, output: 1500 },
  },
  transcriptionCentsPerMinute: 0.6,
};

const ids = new Set(MODELS.map((m) => m.id));
const asIds = (v: unknown): ModelId[] | null => (Array.isArray(v) ? v.filter((x): x is ModelId => ids.has(x)) : null);

export function parseAiSettings(value: unknown): AiSettings {
  const v = (value ?? {}) as Partial<AiSettings>;
  return {
    enabled: asIds(v.enabled) ?? DEFAULT_AI_SETTINGS.enabled,
    defaultChat: ids.has(v.defaultChat as ModelId) ? (v.defaultChat as ModelId) : DEFAULT_AI_SETTINGS.defaultChat,
    summaryOrder: asIds(v.summaryOrder) ?? DEFAULT_AI_SETTINGS.summaryOrder,
    models: v.models && typeof v.models === "object" ? v.models : {},
    prices: v.prices && typeof v.prices === "object" ? { ...DEFAULT_AI_SETTINGS.prices, ...v.prices } : DEFAULT_AI_SETTINGS.prices,
    transcriptionCentsPerMinute: typeof v.transcriptionCentsPerMinute === "number" ? v.transcriptionCentsPerMinute : DEFAULT_AI_SETTINGS.transcriptionCentsPerMinute,
  };
}

export async function getAiSettings(supabase: SupabaseClient): Promise<AiSettings> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "ai").maybeSingle();
  return parseAiSettings(data?.value);
}

export function estimateCost(settings: AiSettings, model: string, input = 0, output = 0): number | null {
  const p = settings.prices[model];
  return p ? (input * p.input + output * p.output) / 1_000_000 : null;
}
