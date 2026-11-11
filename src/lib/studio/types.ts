// Recording Studio shared types and labels (client and server).

export const STUDIO_KINDS = [
  { id: "greeting", label: "Greeting" },
  { id: "extension", label: "Extension prompt" },
  { id: "ivr", label: "Phone menu" },
  { id: "hold", label: "Hold message" },
  { id: "voicemail", label: "Voicemail greeting" },
  { id: "other", label: "Other" },
] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number]["id"];

export const STUDIO_STATUSES = ["draft", "in_review", "approved", "live"] as const;
export type StudioStatus = (typeof STUDIO_STATUSES)[number];

export const STATUS_META: Record<StudioStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  in_review: { label: "In review", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  approved: { label: "Approved", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  live: { label: "Live", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

export type StudioSource = "record" | "upload" | "ai" | "mix";

export type StudioAudio = {
  id: string; name: string; description: string | null; kind: StudioKind; status: StudioStatus; source: StudioSource;
  ai_provider: string | null; ai_voice: string | null; mime: string; size_bytes: number; duration_seconds: number | null;
  image: string | null; archived_at: string | null; created_at: string;
  url: string | null; // short-lived signed URL for playback and download
};

export const kindLabel = (k: string) => STUDIO_KINDS.find((x) => x.id === k)?.label ?? "Other";
export const isKind = (k: unknown): k is StudioKind => STUDIO_KINDS.some((x) => x.id === k);
export const isStatus = (s: unknown): s is StudioStatus => STUDIO_STATUSES.includes(s as StudioStatus);

// Limits shared by the routes and the editor.
export const MAX_SCRIPT = 2000;
export const AI_PER_DAY = 40;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
