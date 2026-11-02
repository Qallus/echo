import "server-only";
import type { OpenAIModel } from "./models";

export type Segment = { speaker: string; start_sec: number; text: string };
export type TranscriptResult = { segments: Segment[]; durationSec: number | null };

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

type Diarized = { duration?: number; segments?: { speaker: string; start: number; end: number; text: string }[] };
type Plain = { text?: string };

// POST /v1/audio/transcriptions. The diarize model returns speaker-labelled,
// timestamped segments; gpt-transcribe returns text only.
export async function transcribeWithOpenAI(audio: Blob, fileName: string, model: OpenAIModel, durationSec: number): Promise<TranscriptResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Transcription isn't set up: OPENAI_API_KEY is missing.");

  const form = new FormData();
  form.append("file", audio, fileName);
  form.append("model", model);
  if (model === "gpt-4o-transcribe-diarize") {
    form.append("response_format", "diarized_json");
    form.append("chunking_strategy", "auto"); // required for audio over 30 s
  } else {
    form.append("response_format", "json");
  }

  const res = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`OpenAI couldn't transcribe this (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }

  if (model === "gpt-4o-transcribe-diarize") {
    const data = (await res.json()) as Diarized;
    const segments = mergeTurns((data.segments ?? []).map((s) => ({
      speaker: `Speaker ${s.speaker}`, start_sec: Math.max(0, Math.floor(s.start)), text: s.text.trim(),
    })));
    return { segments, durationSec: data.duration ? Math.round(data.duration) : null };
  }

  const data = (await res.json()) as Plain;
  return { segments: estimateSegments(data.text ?? "", durationSec), durationSec: null };
}

// Join short consecutive segments from the same speaker, but keep paragraphs
// short: each one keeps only its first timestamp, and highlights, the
// transcript and seeking all depend on those times.
const MAX_PARAGRAPH = 300;

function mergeTurns(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    if (!s.text) continue;
    const last = out.at(-1);
    if (last && last.speaker === s.speaker && last.text.length + s.text.length < MAX_PARAGRAPH) last.text = `${last.text} ${s.text}`;
    else out.push({ ...s });
  }
  return out;
}

// Text-only models: split into short paragraphs and estimate each start time
// from its position in the text.
function estimateSegments(text: string, durationSec: number): Segment[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [];
  const paragraphs: string[] = [];
  let current = "";
  for (const s of sentences) {
    current += s;
    if (current.length > MAX_PARAGRAPH) { paragraphs.push(current.trim()); current = ""; }
  }
  if (current.trim()) paragraphs.push(current.trim());
  const total = text.length || 1;
  let offset = 0;
  return paragraphs.map((p) => {
    const seg = { speaker: "Speaker", start_sec: Math.floor((offset / total) * durationSec), text: p };
    offset += p.length;
    return seg;
  });
}
