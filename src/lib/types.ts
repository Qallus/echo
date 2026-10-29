// App-level shapes. Mapped from Supabase rows in src/lib/data.ts.

export type RecordingSource = "phone_call" | "meeting" | "upload" | "desktop";
export type RecordingStatus = "none" | "processing" | "generated" | "failed";
export type WorkspaceRole = "owner" | "admin" | "member";

export type Workspace = { id: string; name: string; role: WorkspaceRole; isPersonal: boolean };

export type Recording = {
  id: string;
  title: string;
  source: RecordingSource;
  status: RecordingStatus;
  durationSec: number;
  createdAt: string; // ISO
  folderId: string | null;
  deletedAt: string | null;
};

export type Folder = { id: string; name: string };

export type Segment = { speaker: string; startSec: number; text: string };
export type Highlight = { startSec: number; text: string };
export type ActionItem = { id: string; text: string; done: boolean };
export type ActionGroup = { owner: string; role: string | null; items: ActionItem[] };

export type Summary = {
  template: string;
  model: string | null;
  overview: string;
  keyPoints: string[];
  actionGroups: ActionGroup[];
  mindMap: { root: string; branches: string[] };
};

export type RecordingDetail = {
  recording: Recording;
  segments: Segment[];
  highlights: Highlight[];
  summary: Summary | null;
};

export const SOURCES: Record<RecordingSource, { label: string; slug: string }> = {
  phone_call: { label: "Phone calls", slug: "calls" },
  meeting: { label: "Meetings", slug: "meetings" },
  upload: { label: "Uploads", slug: "uploads" },
  desktop: { label: "Desktop", slug: "desktop" },
};
