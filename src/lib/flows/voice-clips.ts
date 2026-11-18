import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveStudioFile } from "@/lib/studio/save";
import { synthesize } from "@/lib/studio/tts";
import { BLOCKS, type Flow } from "./schema";
import { voiceKey } from "./voices";

// When a call tree with an AI voice is published, every prompt written as
// text is turned into a Recording Studio clip in that voice (once; a clip is
// made again only when its words or the voice change). Prompts with {{…}}
// change per call, so they're spoken live instead. Runs as the signed-in
// owner, so the clips land in their Studio library.

type Prompt = { audioId?: string; text?: string; ai?: { audioId: string; text: string; voice: string } };

export async function voiceFlow(supabase: SupabaseClient, ownerId: string, flow: Flow, flowName: string) {
  const voice = flow.settings.voice;
  if (!voice) return { flow, made: 0, errors: [] as string[] };
  const key = voiceKey(voice);
  const errors: string[] = [];
  let made = 0;
  const nodes = [];
  for (const node of flow.nodes) {
    const cfg = node.config as Record<string, unknown>;
    const p = cfg.prompt as Prompt | undefined;
    const words = p?.text?.trim();
    if (!p || p.audioId || !words || words.includes("{{") || (p.ai && p.ai.text === words && p.ai.voice === key)) { nodes.push(node); continue; }
    const tts = await synthesize(voice.provider, { script: words, voice: voice.id, speed: 1 });
    if ("error" in tts) { errors.push(`${node.label || BLOCKS[node.type].label}: ${tts.error}`); nodes.push(node); continue; }
    const saved = await saveStudioFile(supabase, ownerId, {
      bytes: tts.buffer, mime: tts.mime, name: `${flowName} · ${node.label || BLOCKS[node.type].label}`.slice(0, 120), source: "ai",
      kind: node.type === "gather" ? "ivr" : node.type === "voicemail" ? "voicemail" : "greeting", description: words,
      aiProvider: voice.provider, aiVoice: voice.id,
    });
    if ("error" in saved) { errors.push(`${node.label}: ${saved.error}`); nodes.push(node); continue; }
    made++;
    nodes.push({ ...node, config: { ...cfg, prompt: { ...p, ai: { audioId: saved.id, text: words, voice: key } } } });
  }
  return { flow: { ...flow, nodes }, made, errors };
}
