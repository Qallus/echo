import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { echoModel } from "@/lib/ai/providers";

// "Does AI recommend Redial?" Once a month (or on Run now) each AI assistant
// is asked the questions people really ask, and we record whether Redial is
// named, where it ranks among the brands named, which competitors appear and
// which links are cited. Uses Redial's own AI keys; a few cents a run.
// Settings (questions, competitors) live in platform_settings "ai_visibility".

export type VisibilitySettings = { questions: string[]; competitors: string[] };

export const DEFAULT_VISIBILITY: VisibilitySettings = {
  questions: [
    "What is the best AI receptionist for a small business?",
    "How can I stop scam calls to my elderly parents' phone?",
    "What are the best RingCentral alternatives with an AI receptionist?",
    "What is the best app to screen unknown phone calls with AI?",
    "What home phone service blocks spam calls in Arizona?",
    "Which service answers my business calls when I'm busy and texts me a summary?",
    "How can I keep my business phone number and add an AI assistant to answer calls?",
    "What is the best call screening service for a family?",
  ],
  competitors: [
    "RingCentral", "Nextiva", "Dialpad", "Ooma", "Grasshopper", "Vonage", "Smith.ai", "Ruby", "Goodcall", "Rosie", "My AI Front Desk",
    "Truecaller", "Nomorobo", "Hiya", "RoboKiller", "Google Voice", "Google Pixel Call Screen", "Aloware", "OpenPhone", "Quo",
  ],
};

export const ASSISTANTS = [
  { id: "chatgpt", label: "ChatGPT", provider: "gpt" as const },
  { id: "claude", label: "Claude", provider: "claude" as const },
  { id: "gemini", label: "Gemini", provider: "gemini" as const },
  { id: "grok", label: "Grok", provider: "grok" as const },
  { id: "perplexity", label: "Perplexity", provider: "openrouter" as const, model: "perplexity/sonar" },
];

export function readVisibility(value: unknown): VisibilitySettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<VisibilitySettings>;
  const list = (x: unknown, max: number, len: number) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").map((s) => s.trim().slice(0, len)).filter(Boolean).slice(0, max) : null);
  return { questions: list(v.questions, 30, 300) ?? DEFAULT_VISIBILITY.questions, competitors: list(v.competitors, 50, 60) ?? DEFAULT_VISIBILITY.competitors };
}

export async function loadVisibility(db: SupabaseClient) {
  const { data } = await db.from("platform_settings").select("value").eq("key", "ai_visibility").maybeSingle();
  return readVisibility(data?.value);
}

// Which assistants have a key set.
export async function availableAssistants() {
  const out: typeof ASSISTANTS = [];
  for (const a of ASSISTANTS) if (await echoModel(a.provider, "model" in a ? a.model : undefined)) out.push(a);
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function analyze(answer: string, competitors: string[]) {
  const named: { brand: string; at: number }[] = [];
  const redial = answer.search(/\bRedial\b|redial\.si/);
  if (redial >= 0) named.push({ brand: "Redial", at: redial });
  for (const c of competitors) {
    const at = answer.search(new RegExp(`\\b${esc(c)}\\b`, "i"));
    if (at >= 0) named.push({ brand: c, at });
  }
  named.sort((a, b) => a.at - b.at);
  const rank = named.findIndex((n) => n.brand === "Redial");
  const urls = [...new Set((answer.match(/https?:\/\/[^\s)\]>"']+/g) ?? []).map((u) => u.replace(/[.,;:]+$/, "")))].slice(0, 30);
  return { mentioned: redial >= 0, rank: rank >= 0 ? rank + 1 : null, competitors: named.filter((n) => n.brand !== "Redial").map((n) => n.brand), cited_urls: urls };
}

export async function startVisibilityRun(db: SupabaseClient): Promise<{ runId?: string; error?: string }> {
  const s = await loadVisibility(db);
  const assistants = await availableAssistants();
  if (!assistants.length) return { error: "No AI keys are set (Admin -> Settings -> Integrations -> AI providers)." };
  const { data, error } = await db.from("ai_visibility_runs").insert({ questions: s.questions, models: assistants.map((a) => a.id) }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Couldn't start." };
  return { runId: data.id };
}

// Ask the next few questions of a run; closes the run when every pair is done.
export async function processVisibilityRun(db: SupabaseClient, runId: string, limit = 4): Promise<{ done: number; total: number; finished: boolean }> {
  const { data: run } = await db.from("ai_visibility_runs").select("id, questions, models, status").eq("id", runId).maybeSingle();
  if (!run) return { done: 0, total: 0, finished: true };
  const total = run.questions.length * run.models.length;
  const { data: have } = await db.from("ai_visibility_checks").select("model, question").eq("run_id", runId);
  const seen = new Set((have ?? []).map((h) => `${h.model}|${h.question}`));
  if (run.status !== "running") return { done: seen.size, total, finished: true };
  const todo: { model: string; question: string }[] = [];
  for (const question of run.questions) for (const model of run.models) if (!seen.has(`${model}|${question}`)) todo.push({ model, question });
  const { competitors } = await loadVisibility(db);

  await Promise.all(todo.slice(0, limit).map(async ({ model, question }) => {
    const a = ASSISTANTS.find((x) => x.id === model);
    const m = a ? await echoModel(a.provider, "model" in a ? a.model : undefined) : null;
    let row: Record<string, unknown> = { run_id: runId, model, question };
    try {
      if (!m) throw new Error("No key for this assistant.");
      const { text } = await generateText({ model: m, prompt: question, maxOutputTokens: 900, abortSignal: AbortSignal.timeout(45_000) });
      row = { ...row, ...analyze(text, competitors), answer: text.slice(0, 6000) };
    } catch (e) {
      row = { ...row, error: (e instanceof Error ? e.message : "Failed").slice(0, 300) };
    }
    await db.from("ai_visibility_checks").upsert(row, { onConflict: "run_id,model,question", ignoreDuplicates: true });
    seen.add(`${model}|${question}`);
  }));
  const finished = seen.size >= total;
  if (finished) await db.from("ai_visibility_runs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", runId);
  return { done: seen.size, total, finished };
}

// Cron: start a run when the last one is a month old, and work on open runs.
export async function visibilityCron(db: SupabaseClient, budgetMs = 60_000) {
  const until = Date.now() + budgetMs;
  const { data: last } = await db.from("ai_visibility_runs").select("id, created_at, status").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let runId = last?.status === "running" ? last.id : null;
  if (!last || (last.status === "done" && Date.now() - Date.parse(last.created_at) > 30 * 86400_000)) runId = (await startVisibilityRun(db)).runId ?? null;
  let n = 0;
  while (runId && Date.now() < until) {
    const p = await processVisibilityRun(db, runId, 4);
    n++;
    if (p.finished) break;
  }
  return n;
}
