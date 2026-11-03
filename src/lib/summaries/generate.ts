import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerKeys, logUsage, reportKeyFailure, resolveCandidates, type ModelChoice, type Resolved } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { formatClock } from "@/lib/format";
import { findTemplate } from "@/lib/templates";

// Turns a transcript into a summary for a template: sections, key points,
// action items, timestamped highlights and a mind map. Writes with the
// caller's client, so RLS applies.

const MAX_TRANSCRIPT_CHARS = 180_000;

const schema = z.object({
  title: z.string().describe("A short, specific title for this recording (max 80 characters)."),
  overview: z.string().describe("2-4 sentence overview of the whole conversation."),
  sections: z.array(z.object({
    heading: z.string(),
    bullets: z.array(z.string()).describe("Specific, factual bullets. Empty if the topic didn't come up."),
  })).describe("One entry per template section, in the given order, with the given headings."),
  keyPoints: z.array(z.string()).describe("3-7 most important points."),
  actionItems: z.array(z.object({
    owner: z.string().describe("Name or speaker label of the person responsible; 'Unassigned' if unclear."),
    text: z.string(),
  })),
  highlights: z.array(z.object({
    startSec: z.number().int().describe("Seconds from the start, taken from the transcript timestamps."),
    title: z.string().describe("One sentence stating what happened."),
    bullets: z.array(z.string()).describe("2-4 supporting details."),
  })).describe("3-8 moments worth jumping back to, in time order."),
  mindMap: z.object({ root: z.string(), branches: z.array(z.string()).describe("4-7 short branch labels.") }),
});

export type GenerateOptions = { templateId: string; modelId?: ModelChoice; language?: string; feature?: "summary" | "mcp" };

export async function generateSummary(supabase: SupabaseClient, recordingId: string, opts: GenerateOptions): Promise<{ error?: string }> {
  const template = findTemplate(opts.templateId);
  const [{ data: rec }, { data: segs }] = await Promise.all([
    supabase.from("recordings").select("id, title, workspace_id").eq("id", recordingId).maybeSingle(),
    supabase.from("transcript_segments").select("speaker, start_sec, text").eq("recording_id", recordingId).order("position"),
  ]);
  if (!rec) return { error: "Recording not found." };
  if (!segs?.length) return { error: "There's no transcript to summarize yet." };

  const transcript = segs.map((s) => `[${s.start_sec}s ${formatClock(s.start_sec)}] ${s.speaker}: ${s.text}`).join("\n").slice(0, MAX_TRANSCRIPT_CHARS);
  const language = opts.language || "English";
  const system = `You write meeting and call summaries for Echo. Use only what is in the transcript; never invent names, numbers or decisions.
Write in ${language}. Be specific and concise. Refer to people by name when the transcript gives one, otherwise by speaker label.
Template: "${template.name}". Sections, in order: ${template.sections.map((s) => `"${s}"`).join(", ")}.${template.guidance ? `\n${template.guidance}` : ""}
Highlight timestamps must come from the [Ns] markers in the transcript.`;

  // The picked model first, then the Super Admin fallback order. For each,
  // the customer's own key (if any) is tried before Echo's.
  const settings = await getAiSettings(supabase);
  const keys = await customerKeys(supabase, rec.workspace_id);
  const order = [opts.modelId, ...settings.summaryOrder].filter((m, i, a): m is ModelChoice => !!m && a.indexOf(m) === i);
  const attempts: Resolved[] = [];
  for (const choice of order) attempts.push(...(await resolveCandidates(supabase, choice, { workspaceId: rec.workspace_id, settings, keys })));

  let lastError = "No AI model is configured.";
  for (const [i, picked] of attempts.entries()) {
    const started = Date.now();
    const usage = { workspaceId: rec.workspace_id, feature: opts.feature ?? "summary", resolved: picked, fallback: i > 0, settings } as const;
    try {
      const { output, usage: tokens } = await generateText({
        model: picked.model, system, prompt: `Recording: "${rec.title}"\n\nTranscript:\n${transcript}`, output: Output.object({ schema }),
      });
      void logUsage(supabase, { ...usage, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, latencyMs: Date.now() - started });
      await save(supabase, recordingId, output, template.name, picked.label, language, rec.title);
      return {};
    } catch (e) {
      lastError = `${picked.label}: ${e instanceof Error ? e.message : String(e)}`;
      console.error(`[summary] ${recordingId}`, lastError);
      if (picked.keyId) await reportKeyFailure(supabase, picked.keyId, e);
      void logUsage(supabase, { ...usage, ok: false, error: lastError, latencyMs: Date.now() - started });
    }
  }
  return { error: lastError.slice(0, 400) };
}

async function save(supabase: SupabaseClient, recordingId: string, s: z.infer<typeof schema>, template: string, model: string, language: string, currentTitle: string) {
  const { error } = await supabase.from("summaries").upsert({
    recording_id: recordingId,
    template, model, language,
    title: s.title.slice(0, 200),
    overview: s.overview,
    key_points: s.keyPoints,
    sections: s.sections,
    mind_map: s.mindMap,
  });
  if (error) throw new Error(error.message);

  await supabase.from("action_items").delete().eq("recording_id", recordingId);
  if (s.actionItems.length) {
    await supabase.from("action_items").insert(s.actionItems.map((a, i) => ({ recording_id: recordingId, position: i, owner_name: a.owner, text: a.text })));
  }
  await supabase.from("highlights").delete().eq("recording_id", recordingId).eq("kind", "ai");
  if (s.highlights.length) {
    await supabase.from("highlights").insert(s.highlights.map((h) => ({
      recording_id: recordingId, kind: "ai", start_sec: Math.max(0, h.startSec), text: h.title, title: h.title.slice(0, 300), bullets: h.bullets,
    })));
  }
  // Only the recorder's default titles ("Meeting Oct 30, 5:24 PM") and
  // "Untitled recording" are replaced; titles people typed are kept.
  const generic = /^untitled\b/i.test(currentTitle) || /^\w[\w ]* [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?(AM|PM)?$/i.test(currentTitle);
  await supabase.from("recordings").update({ status: "generated", ...(generic ? { title: s.title.slice(0, 200) } : {}) }).eq("id", recordingId);
}
