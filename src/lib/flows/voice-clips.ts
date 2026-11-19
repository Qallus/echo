import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveStudioFile } from "@/lib/studio/save";
import { synthesize } from "@/lib/studio/tts";
import { BLOCKS, type Flow } from "./schema";
import { DIRECTORY_CONNECTING, DIRECTORY_NOT_FOUND, PHRASES, voiceKey } from "./voices";

// When a call tree with an AI voice is published, every prompt written as
// text is turned into a Recording Studio clip in that voice (once; a clip is
// made again only when its words or the voice change). Prompts with {{…}}
// change per call, so they're spoken live instead. Runs as the signed-in
// owner, so the clips land in their Studio library.

type Prompt = { audioId?: string; text?: string; ai?: { audioId: string; text: string; voice: string } };

// `names`: the people Dial by name can reach on the lines it runs on.
export async function voiceFlow(supabase: SupabaseClient, ownerId: string, flow: Flow, flowName: string, names: string[] = []) {
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
  // The short phrases, and "Connecting you to <name>" for each person.
  const words = new Set<string>(Object.values(PHRASES));
  for (const node of flow.nodes.filter((n) => n.type === "directory")) {
    const cfg = node.config as { connecting?: string; notFound?: string };
    const notFound = (cfg.notFound || DIRECTORY_NOT_FOUND).trim();
    if (!notFound.includes("{{")) words.add(notFound);
    for (const name of names) words.add((cfg.connecting || DIRECTORY_CONNECTING).replace(/\{\{\s*name\s*\}\}/g, name).trim());
  }
  const voiced: NonNullable<Flow["settings"]["voiced"]> = {};
  for (const text of words) {
    if (!text || text.includes("{{") || text.length > 300) continue;
    const had = flow.settings.voiced?.[text];
    if (had && had.voice === key) { voiced[text] = had; continue; }
    const tts = await synthesize(voice.provider, { script: text, voice: voice.id, speed: 1 });
    if ("error" in tts) { errors.push(`"${text}": ${tts.error}`); continue; }
    const saved = await saveStudioFile(supabase, ownerId, {
      bytes: tts.buffer, mime: tts.mime, name: `${flowName} · ${text}`.slice(0, 120), source: "ai", kind: "ivr", description: text,
      aiProvider: voice.provider, aiVoice: voice.id,
    });
    if ("error" in saved) { errors.push(`"${text}": ${saved.error}`); continue; }
    made++;
    voiced[text] = { audioId: saved.id, voice: key };
  }
  return { flow: { ...flow, nodes, settings: { ...flow.settings, voiced } }, made, errors };
}
