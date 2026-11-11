"use server";

import { generateText } from "ai";
import { logUsage, reportKeyFailure, resolveCandidates, type ModelChoice, type Resolved } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG, layoutFlow } from "./blocks";
import { BLOCKS, BLOCK_TYPES, FLOW_SCHEMA, flowSchema, validateFlow, type Flow, type Issue } from "./schema";

// Build with AI: turns a plain-English description (or a change request) into
// a call tree. The model writes the JSON; it's checked with the same schema
// and validator as the builder, positions are laid out, and the person sees a
// preview before anything is applied.

const SPEC = BLOCK_TYPES.map((t) => {
  const outs = [...BLOCKS[t].outs];
  const dyn = t === "gather" ? " plus one output per option (options[].out)" : t === "split" ? " plus one output per rule (rules[].out)" : t === "ai" ? " plus one output per intent (intents[].out)" : "";
  return `- "${t}" (${BLOCKS[t].label}): config like ${JSON.stringify(DEFAULT_CONFIG[t])}. Outputs: ${outs.length ? outs.join(", ") : "none"}${dyn}.`;
}).join("\n");

const SYSTEM = `You design phone call trees (IVRs) for Redial. Reply with ONLY one JSON object, no prose, in this format:
{"schema":${FLOW_SCHEMA},"name":"...","settings":{"timezone":"America/Phoenix","recording":"off","onUnconnected":"ai_or_voicemail"},"start":"incoming","nodes":[{"id":"incoming","type":"trigger.call","label":"Incoming call","pos":[0,0],"config":{},"next":{"next":"<id>"}}, ...]}

Rules:
- Node ids are lowercase letters, digits and underscores, start with a letter, unique, at most 40 characters.
- Exactly one "trigger.call" node, and "start" is its id. Nothing may connect back to it.
- "next" maps an output name to the id of the block it goes to. Only use outputs the block has.
- Prompts are {"text":"..."} (read aloud) or {"audioId":"<uuid>"} for a recording the person already has; use text unless a recording id is given.
- Connect targets are {"number":"+1XXXXXXXXXX"}, {"extensionId":"<uuid>"} or {"directoryId":"<uuid>"}. Use only numbers and ids the person gave; if they didn't give one, leave targets empty so they can fill it in.
- Gather options: each has a unique "out" id, an optional single-character "key" (0-9, *, #) and optional "speech" words.
- Keep wording short and natural for a phone call. Don't invent business hours, prices or phone numbers.
- When changing an existing call tree, keep the ids of blocks you don't change.

Block types:
${SPEC}`;

export type AiResult = { flow?: Flow; issues?: Issue[]; error?: string; model?: string };

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export async function buildFlowWithAi(request: string, current: unknown): Promise<AiResult> {
  await requireUser();
  const ask = request.trim().slice(0, 2000);
  if (ask.length < 5) return { error: "Describe what callers should hear and where calls should go." };
  const now = flowSchema.safeParse(current);
  const supabase = await createClient();
  const settings = await getAiSettings(supabase);
  const order = (settings.summaryOrder as ModelChoice[]).filter((m, i, a) => !!m && a.indexOf(m) === i);
  const attempts: Resolved[] = [];
  for (const choice of order) attempts.push(...(await resolveCandidates(supabase, choice, { settings })));
  if (!attempts.length) return { error: "AI isn't set up for your account yet." };

  const prompt = now.success
    ? `Here is the current call tree:\n${JSON.stringify({ ...now.data, nodes: now.data.nodes.map((n) => ({ ...n, pos: undefined })) })}\n\nChange it as follows: ${ask}`
    : `Create a call tree: ${ask}`;
  for (const [i, picked] of attempts.entries()) {
    const started = Date.now();
    try {
      const { text, usage } = await generateText({ model: picked.model, system: SYSTEM, prompt, maxOutputTokens: 6000 });
      void logUsage(supabase, { feature: "chat", resolved: picked, fallback: i > 0, settings, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, latencyMs: Date.now() - started });
      const raw = extractJson(text) as Record<string, unknown> | null;
      if (!raw) continue;
      const parsed = flowSchema.safeParse({ ...raw, schema: FLOW_SCHEMA, name: raw.name || (now.success ? now.data.name : "New call tree") });
      if (!parsed.success) continue;
      const flow = layoutFlow(parsed.data, now.success ? now.data : null);
      return { flow, issues: validateFlow(flow).issues, model: picked.label };
    } catch (e) {
      if (picked.keyId) await reportKeyFailure(supabase, picked.keyId, e);
      console.error("[call tree ai]", e instanceof Error ? e.message : e);
    }
  }
  return { error: "The AI couldn't build a valid call tree from that. Try describing it a little differently." };
}
