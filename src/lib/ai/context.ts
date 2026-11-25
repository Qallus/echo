import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRecordingDetail, listRecordings, listWorkspaces } from "@/lib/data";
import { formatClock, formatDuration } from "@/lib/format";
import { namedLines } from "@/lib/speakers";
import { DASH_ENTRIES } from "@/lib/dashboard-search";
import { visibleFeatures } from "@/lib/features";
import { getStaff } from "@/lib/admin/guard";
import { callsBadge } from "@/lib/redial/data";
import { hasLiveAgentProfile } from "@/lib/live-agents/agent-data";

// Builds the system prompt from the user's own data (RLS-scoped reads).

const BASE = `You are Echo, the assistant inside Redial: a phone, recording, SMS, scheduling and planning app for personal life and business.
For questions about recordings, answer from the recording context provided. If it doesn't contain the answer, say so plainly.
For questions about Redial itself ("what can I do", "list the features", "where is…", "how do I…"), answer from the <features> list:
- Group features under the same headings as the list. For each one give a Markdown link using the path exactly as written (for example [Calendar](/calendar)), one sentence on what it does, and how to use it for personal life and for a business.
- Only link to paths that appear in <features>. Never invent a page or a feature. Say "coming soon" for features marked soon.
- Explain steps plainly and in order when someone asks how to do something.
Be concise. Use Markdown for lists and headings when it helps. When drafting emails or messages, write them ready to send.`;

// What this person can use in Redial, for "what can I do" questions. Staff
// (MFA-verified) also get the Admin dashboard sections their role allows.
async function featureCatalog(): Promise<string> {
  const [calls, liveAgent, staff] = await Promise.all([callsBadge(), hasLiveAgentProfile(), getStaff()]);
  const line = calls !== null;
  const user = visibleFeatures({ line, liveAgent })
    .map((f) => `- [${f.group}] ${f.title} (${f.href})${f.soon ? " [coming soon]" : ""}: ${f.what} Personal: ${f.personal} Business: ${f.business}`);
  const perms = staff?.mfaVerified ? staff.permissions : [];
  const admin = DASH_ENTRIES.filter((e) => e.cat === "admin" && (!e.permission || perms.includes(e.permission as never)))
    .map((e) => `- [Admin dashboard] ${e.title} (${e.href}): ${e.desc}.`);
  const adminBlock = admin.length ? ["", "", "Admin dashboard (this person is Redial staff):", ...admin].join("\n") : "";
  return `<features>
User dashboard${line ? "" : " (no Redial phone line yet: point phone features to Set up Redial at /setup)"}:
${user.join("\n")}${adminBlock}
</features>`;
}

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

${await featureCatalog()}

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

${await featureCatalog()}

The user is asking across their whole library. Recordings (newest first):
${library || "No recordings yet."}`;
}
