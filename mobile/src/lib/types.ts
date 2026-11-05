// Shapes returned by the mobile API (docs/MOBILE_API.md). Redial's own types
// come from the website (@shared/types).
import type { Access, Call, Callback, Line, ListEntry } from "@shared/types";

export type { Access, Call, Callback, Line, ListEntry };
export type MyLine = Line & { access: Access };
export type Me = {
  user: { id: string; email: string };
  profile: { full_name: string | null; avatar_url: string | null; timezone: string | null; push_privacy: "full" | "caller" | "private" } | null;
  workspaces: { id: string; name: string; isPersonal: boolean; role: string }[];
  lines: MyLine[];
  unreadCalls: number | null;
};
export type LineData = { line: MyLine; calls: Call[]; entries: ListEntry[]; callbacks: Callback[] };
export type RecordingRow = { id: string; title: string; createdAt: string; durationSec: number; status: string; workspaceId: string; source: string };
export type RecordingDetail = {
  recording: RecordingRow;
  segments: { speaker: string; startSec: number; text: string }[];
  summary: { overview: string; keyPoints: string[]; actionGroups: { owner: string; items: { id: string; text: string; done: boolean }[] }[] } | null;
  audioUrl: string | null;
};
