import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRecordingDetail, listRecordings, listWorkspaces } from "@/lib/data";
import { formatClock, formatDuration } from "@/lib/format";
import { namedLines } from "@/lib/speakers";

// Builds the system prompt from the user's own data (RLS-scoped reads).

const BASE = `You are Echo, an assistant inside a call and meeting recording app.
Answer from the recording context provided. If the context doesn't contain the answer, say so plainly.
Be concise. Use Markdown for lists and headings when it helps. When drafting emails or messages, write them ready to send.`;

const MAX_LIBRARY_ITEMS = 200;

// Returns null when the recording doesn't exist or the user can't access it.
export async function buildRecordingPrompt(recordingId: string): Promise<string | null> {
  const d = await getRecordingDetail(recordingId);
  if (!d) return null;
  const r = d.recording;
  const transcript = namedLines(d, formatClock).join("\n");
  const summary = d.summary
    ? [
        `Overview: ${d.summary.overview}`,
        `Key points:\n${d.summary.keyPoints.map((k) => `- ${k}`).join("\n")}`,
        `Action items:\n${d.summary.actionGroups.flatMap((g) => g.items.map((i) => `- ${g.owner}: ${i.text}${i.done ? " (done)" : ""}`)).join("\n")}`,
      ].join("\n\n")
    : "No summary yet.";
  return `${BASE}

<recording title="${r.title}" date="${r.createdAt}" duration="${formatDuration(r.durationSec)}">
<transcript>
${transcript || "No transcript yet."}
</transcript>
<summary>
${summary}
</summary>
</recording>`;
}

export async function buildLibraryPrompt(): Promise<string> {
  const [all, workspaces] = await Promise.all([listRecordings(), listWorkspaces()]);
  const recordings = all.filter((r) => !r.deletedAt).slice(0, MAX_LIBRARY_ITEMS);
  const space = new Map(workspaces.map((w) => [w.id, w.isPersonal ? "Personal" : `Business: ${w.name}`]));
  const supabase = await createClient();
  const { data: sums } = recordings.length
    ? await supabase.from("summaries").select("recording_id, overview").in("recording_id", recordings.map((r) => r.id))
    : { data: [] };
  const overview = new Map((sums ?? []).map((s) => [s.recording_id, s.overview]));
  const library = recordings
    .map((r) => `- "${r.title}" (${space.get(r.workspaceId)}, ${r.createdAt}, ${formatDuration(r.durationSec)})${overview.get(r.id) ? `: ${overview.get(r.id)}` : ""}`)
    .join("\n");
  return `${BASE}

The user is asking across their whole library. Recordings (newest first):
${library || "No recordings yet."}`;
}
