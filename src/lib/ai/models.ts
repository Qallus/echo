// Client-safe model registry. Server-only provider wiring lives in providers.ts.

export type ModelId = "claude" | "gpt" | "grok" | "kimi";

export type ModelOption = { id: ModelId; label: string; vendor: string };

export const MODELS: ModelOption[] = [
  { id: "claude", label: "Claude", vendor: "Anthropic" },
  { id: "gpt", label: "ChatGPT", vendor: "OpenAI" },
  { id: "grok", label: "Grok", vendor: "xAI" },
  { id: "kimi", label: "Kimi K3", vendor: "Moonshot" },
];

export const DEFAULT_MODEL: ModelId = "claude";

export function isModelId(v: unknown): v is ModelId {
  return MODELS.some((m) => m.id === v);
}
