// Shared recordings: what a public link or a person-share returns (built by
// private.recording_bundle in 20261105100000_recording_share.sql) and the
// share settings shown in the Share dialog. Client-safe.

import { readSpeakers, resolveSpeakers, speakerName } from "@/lib/speakers";

export type SharePart = "summary" | "transcript" | "highlights" | "audio";
export const SHARE_PARTS: { id: SharePart; label: string }[] = [
  { id: "summary", label: "Summary and action items" },
  { id: "transcript", label: "Transcript" },
  { id: "highlights", label: "Highlights and notes" },
  { id: "audio", label: "Audio recording" },
];

export type ShareLink = {
  id: string; parts: SharePart[]; expiresAt: string | null; revokedAt: string | null;
  createdBy: string | null; createdAt: string; views: number; lastViewedAt: string | null;
};
export type SharePerson = { id: string; email: string; invitedBy: string | null; createdAt: string };

export type SharedRecording = {
  id: string; title: string; createdAt: string; durationSec: number; owner: string | null;
  audioPath: string | null; expiresAt: string | null;
  summary: { title: string | null; overview: string; keyPoints: string[] } | null;
  actionItems: { owner: string | null; text: string; done: boolean }[] | null;
  highlights: { startSec: number; text: string; kind: string | null; title: string | null }[] | null;
  transcript: { speaker: string; startSec: number; text: string }[] | null;
};

type Row = Record<string, unknown>;
const list = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);

// The bundle's JSON as a typed view, with transcript speaker labels replaced
// by the names the owner gave them.
export function readShared(v: unknown): SharedRecording | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Row;
  const owner = str(b.owner);
  const segs = list(b.segments)?.map((s) => ({ speaker: String(s.speaker ?? "Speaker"), startSec: Number(s.start_sec) || 0, text: String(s.text ?? "") })) ?? null;
  const names = segs ? resolveSpeakers(segs, readSpeakers(b.speakers), owner ? { name: owner } : null) : null;
  const sum = b.summary && typeof b.summary === "object" ? (b.summary as Row) : null;
  return {
    id: String(b.id), title: String(b.title ?? "Recording"), createdAt: String(b.created_at), durationSec: Number(b.duration_sec) || 0,
    owner, audioPath: str(b.audio_path), expiresAt: str(b.expires_at),
    summary: sum ? { title: str(sum.title), overview: String(sum.overview ?? ""), keyPoints: (list(sum.key_points) ?? []).map(String) } : null,
    actionItems: list(b.action_items)?.map((a) => ({ owner: str(a.owner), text: String(a.text ?? ""), done: a.done === true })) ?? null,
    highlights: list(b.highlights)?.map((h) => ({ startSec: Number(h.start_sec) || 0, text: String(h.text ?? ""), kind: str(h.kind), title: str(h.title) })) ?? null,
    transcript: segs && names ? segs.map((s) => ({ ...s, speaker: speakerName(names, s.speaker) })) : null,
  };
}

export function linkParts(l: { show_summary: boolean; show_transcript: boolean; show_highlights: boolean; show_audio: boolean }): SharePart[] {
  return (["summary", "transcript", "highlights", "audio"] as const).filter((p) => l[`show_${p}`]);
}
