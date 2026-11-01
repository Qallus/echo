import "server-only";
import { getRecordingDetail, listRecordings, listWorkspaces } from "@/lib/data";
import { formatDuration } from "@/lib/format";
import type { RecordingDetail } from "@/lib/types";
import type { SummaryData } from "@/components/designs/summary-document";
import type { MergeValues } from "./schema";

// Turns a recording into what the summary document renders.
export function toSummaryData(d: RecordingDetail, listenUrl?: string): SummaryData {
  const s = d.summary;
  return {
    overview: s?.overview ?? "",
    sections: s?.sections ?? [],
    keyPoints: s?.keyPoints ?? [],
    actionGroups: s?.actionGroups ?? [],
    highlights: d.highlights.filter((h) => h.kind === "ai" || !s),
    mindMap: s?.mindMap ?? { root: d.recording.title, branches: [] },
    listenUrl,
  };
}

export function mergeValues(d: RecordingDetail, workspace: string): MergeValues {
  return {
    recording_title: d.summary?.title || d.recording.title,
    date: new Date(d.recording.createdAt).toLocaleDateString("en-US", { dateStyle: "long" }),
    duration: formatDuration(d.recording.durationSec),
    template: d.summary?.template ?? "Summary",
    workspace,
    year: String(new Date().getFullYear()),
  };
}

const SAMPLE: { data: SummaryData; values: MergeValues } = {
  data: {
    overview: "The team approved the launch budget and agreed to ship the new recorder on Friday, with the announcement going out on Monday.",
    sections: [
      { heading: "Decisions made", bullets: ["Ship the recorder on Friday.", "Send the announcement email on Monday."] },
      { heading: "Risks", bullets: ["Panel design must finish this week to hold the date."] },
    ],
    keyPoints: ["Budget approved", "Design finishes the panel this week", "Sales launch call to be booked"],
    actionGroups: [
      { owner: "Ben", role: null, items: [{ id: "a1", text: "Book the launch call with the sales team", done: false }] },
      { owner: "Design", role: null, items: [{ id: "a2", text: "Finish the recorder panel", done: true }] },
    ],
    highlights: [{ id: "h1", startSec: 5, text: "", kind: "ai", title: "Budget approved and design on track.", bullets: ["Design finishes the panel this week."] }],
    mindMap: { root: "Recorder launch", branches: ["Budget", "Design", "Ship Friday", "Announcement"] },
    listenUrl: "#",
  },
  values: { recording_title: "Launch plan review", date: "October 30, 2026", duration: "14m", template: "Meeting minutes", workspace: "Personal", year: String(new Date().getFullYear()) },
};

// Preview content for the builder: your latest summarized recording, or a sample.
export async function builderPreview(): Promise<{ data: SummaryData; values: MergeValues; source: string }> {
  const recent = (await listRecordings()).filter((r) => !r.deletedAt && r.status === "generated").slice(0, 5);
  for (const r of recent) {
    const d = await getRecordingDetail(r.id);
    if (d?.summary) {
      const ws = (await listWorkspaces()).find((w) => w.id === d.recording.workspaceId);
      return { data: toSummaryData(d, "#"), values: mergeValues(d, ws ? (ws.isPersonal ? "Personal" : ws.name) : ""), source: d.recording.title };
    }
  }
  return { ...SAMPLE, source: "Sample recording" };
}
