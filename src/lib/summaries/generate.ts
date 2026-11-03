import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerKeys, logUsage, reportKeyFailure, resolveCandidates, type ModelChoice, type Resolved } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { formatClock } from "@/lib/format";
import { readSpeakers, resolveSpeakers, speakerName } from "@/lib/speakers";
import { findTemplate } from "@/lib/templates";
import { readDates, readItems } from "@/lib/visuals";

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
  visualItems: z.array(z.object({
    label: z.string().describe("Short name of a topic, feature, task or decision (max 6 words)."),
    group: z.string().describe("A category it belongs to, e.g. a person, area or phase."),
    status: z.enum(["idea", "planned", "in_progress", "blocked", "done"]).describe("Its state as discussed."),
    weight: z.number().int().describe("1-100: how much attention or priority it got in the conversation."),
    start: z.string().nullable().describe("YYYY-MM-DD if a start date was discussed, else null."),
    end: z.string().nullable().describe("YYYY-MM-DD if a due or end date was discussed, else null."),
  })).describe("4-10 items behind the summary charts (bars, timeline, kanban, pie, table)."),
  dates: z.array(z.object({
    kind: z.enum(["appointment", "event", "deadline"]).describe("appointment: a meeting or call with specific people; event: something people attend; deadline: a due date."),
    title: z.string().describe("What it is, e.g. 'Site visit with Dana'."),
    date: z.string().describe("YYYY-MM-DD, worked out from the recording date for words like 'next Tuesday'."),
    endDate: z.string().nullable().describe("YYYY-MM-DD for multi-day events, else null."),
    start: z.string().nullable().describe("HH:MM 24-hour if a time was given, else null."),
    end: z.string().nullable().describe("HH:MM 24-hour if an end time or length was given, else null."),
    location: z.string().nullable(),
    people: z.array(z.string()).describe("Names of people involved."),
    quote: z.string().describe("The words from the transcript that mention it (max 25 words)."),
  })).describe("Future appointments, events and deadlines that were mentioned. Empty if none."),
});

export type GenerateOptions = { templateId: string; modelId?: ModelChoice; language?: string; feature?: "summary" | "mcp" };

export async function generateSummary(supabase: SupabaseClient, recordingId: string, opts: GenerateOptions): Promise<{ error?: string }> {
  const template = findTemplate(opts.templateId);
  const [{ data: rec }, { data: segs }] = await Promise.all([
    supabase.from("recordings").select("id, title, workspace_id, created_at, created_by, speakers").eq("id", recordingId).maybeSingle(),
    supabase.from("transcript_segments").select("speaker, start_sec, text").eq("recording_id", recordingId).order("position"),
  ]);
  if (!rec) return { error: "Recording not found." };
  if (!segs?.length) return { error: "There's no transcript to summarize yet." };

  // Speakers by name where people have said who they are (or the recorder,
  // for the voice that talks most).
  const { data: owner } = rec.created_by ? await supabase.from("profiles").select("full_name").eq("id", rec.created_by).maybeSingle() : { data: null };
  const names = resolveSpeakers(segs, readSpeakers(rec.speakers), owner?.full_name ? { name: owner.full_name, userId: rec.created_by } : null);
  const transcript = segs.map((s) => `[${s.start_sec}s ${formatClock(s.start_sec)}] ${speakerName(names, s.speaker)}: ${s.text}`).join("\n").slice(0, MAX_TRANSCRIPT_CHARS);
  const recordedOn = new Date(rec.created_at).toISOString().slice(0, 10);
  const language = opts.language || "English";
  const system = `You write meeting and call summaries for Echo. Use only what is in the transcript; never invent names, numbers or decisions.
Write in ${language}. Be specific and concise. Refer to people by name when the transcript gives one, otherwise by speaker label.
Template: "${template.name}". Sections, in order: ${template.sections.map((s) => `"${s}"`).join(", ")}.${template.guidance ? `\n${template.guidance}` : ""}
Highlight timestamps must come from the [Ns] markers in the transcript.
The recording was made on ${recordedOn} (${new Date(rec.created_at).toLocaleDateString("en-US", { weekday: "long" })}); use it to turn relative dates into real ones.`;

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
    mind_map: { ...s.mindMap, items: readItems(s.visualItems) },
    dates: readDates(s.dates.map((d) => ({ ...d, allDay: !d.start }))),
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
