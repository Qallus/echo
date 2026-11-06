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

// The live-call parts of `line` (directory, Mirror switch) and of `live`
// (src/lib/redial/actions.ts on the website).
export type DirectoryEntry = { id: string; label: string; number: string; note: string | null; sort: number };
export type LineDetail = LineData & { directory: DirectoryEntry[]; mirror: { enabled: boolean } };
export type LiveParticipant = { id: string; role: string; status: string; muted: boolean; me: boolean };
export type LiveDirection = { id: string; text: string; status: "sending" | "delivered" | "failed"; created_at: string; mine: boolean };
export type LiveTransfer = { id: string; label: string; status: "ringing" | "accepted" | "connected" | "declined" | "no_answer" | "failed" | "ended"; created_at: string };
export type LiveSuggestion = {
  id: string; kind: "say" | "answer" | "info" | "caution" | "sms" | "email"; title: string; body: string; subject: string | null;
  source: string | null; status: "new" | "dismissed" | "sending" | "sent" | "failed"; sent_to: string | null; created_at: string;
};
export type LiveCall = {
  id: string; from_number: string | null; caller_id_name: string | null; caller_name: string | null; status: string; started_at: string;
  session: { state: string; ai_state: string; taken_over: "me" | "other" | null; participants: LiveParticipant[] } | null;
  turns: { id: number; role: "caller" | "assistant" | "person"; text: string }[];
  directions: LiveDirection[];
  transfers: LiveTransfer[];
  mirror: { state: string; error: string | null } | null;
  suggestions: LiveSuggestion[];
};
