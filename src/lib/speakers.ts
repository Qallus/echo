// Who's talking: the transcriber labels voices "Speaker A", "Speaker B"…
// People pick who each one is; until then the voice that talks most in
// someone's own recording is taken to be them. Client-safe.

export type SpeakerInfo = { name: string; email?: string | null; avatarUrl?: string | null; userId?: string | null };
export type SpeakerMap = Record<string, SpeakerInfo>;
export type ResolvedSpeaker = SpeakerInfo & { label: string; assumed: boolean };

export function readSpeakers(v: unknown): SpeakerMap {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: SpeakerMap = {};
  for (const [label, info] of Object.entries(v as Record<string, unknown>)) {
    const i = info as Partial<SpeakerInfo> | null;
    if (i && typeof i.name === "string" && i.name.trim()) out[label] = { name: i.name, email: i.email ?? null, avatarUrl: i.avatarUrl ?? null, userId: i.userId ?? null };
  }
  return out;
}

// The label that talks most (by words). Ties go to whoever spoke first.
export function mainSpeaker(segments: { speaker: string; text: string }[]): string | null {
  const words = new Map<string, number>();
  for (const s of segments) words.set(s.speaker, (words.get(s.speaker) ?? 0) + s.text.split(/\s+/).length);
  let best: string | null = null;
  for (const [label, n] of words) if (best === null || n > words.get(best)!) best = label;
  return best;
}

export function resolveSpeakers(segments: { speaker: string; text: string }[], map: SpeakerMap, owner: SpeakerInfo | null): Map<string, ResolvedSpeaker> {
  const main = mainSpeaker(segments);
  const ownerTaken = owner?.userId ? Object.values(map).some((s) => s.userId === owner.userId) : false;
  const out = new Map<string, ResolvedSpeaker>();
  for (const label of new Set(segments.map((s) => s.speaker))) {
    const picked = map[label];
    if (picked) out.set(label, { ...picked, label, assumed: false });
    else if (owner && label === main && !ownerTaken) out.set(label, { ...owner, label, assumed: true });
    else out.set(label, { name: label === "Speaker" ? "Speaker" : label, label, assumed: false });
  }
  return out;
}

export const speakerName = (resolved: Map<string, ResolvedSpeaker>, label: string) => resolved.get(label)?.name ?? label;
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

// "Jordan Lee: …" lines with names resolved, for prompts and exports.
export function namedLines(d: { segments: { speaker: string; text: string; startSec: number }[]; speakers: SpeakerMap; owner: SpeakerInfo | null }, clock: (s: number) => string) {
  const names = resolveSpeakers(d.segments, d.speakers, d.owner);
  return d.segments.map((s) => `[${clock(s.startSec)}] ${speakerName(names, s.speaker)}: ${s.text}`);
}
