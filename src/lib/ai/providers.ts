import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import type { ModelId } from "@/lib/ai/models";

// Each provider: which env var holds the key, which model it runs by default
// (override with the *_MODEL env var), and how to build the SDK model.
const PROVIDERS: Record<ModelId, { keyEnv: string; modelEnv: string; defaultModel: string; build: (key: string, model: string) => LanguageModel }> = {
  claude: {
    keyEnv: "ANTHROPIC_API_KEY", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-sonnet-5-5",
    // Keys not scoped to a workspace must name one (ANTHROPIC_WORKSPACE_ID).
    build: (apiKey, model) => createAnthropic({
      apiKey,
      headers: process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : undefined,
    })(model),
  },
  gpt: {
    keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-6.1-sol",
    build: (apiKey, model) => createOpenAI({ apiKey })(model),
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
};

export function isConfigured(id: ModelId) {
  return Boolean(process.env[PROVIDERS[id].keyEnv]);
}

const LABELS: Record<ModelId, string> = { claude: "Claude", gpt: "ChatGPT", grok: "Grok", kimi: "Kimi" };

export function getLanguageModel(id: ModelId): { model: LanguageModel; label: string } | { error: string } {
  const p = PROVIDERS[id];
  const key = process.env[p.keyEnv];
  if (!key) return { error: `${p.keyEnv} is not set on the server.` };
  return { model: p.build(key, process.env[p.modelEnv] || p.defaultModel), label: LABELS[id] };
}
