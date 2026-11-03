import type { SpeakerInfo, SpeakerMap } from "./speakers";
import type { MentionedDate, VisualItem, VisualKind } from "./visuals";
// App-level shapes. Mapped from Supabase rows in src/lib/data.ts.

import type { ProfileDetail } from "@/lib/profile-details";

export type RecordingSource = "phone_call" | "meeting" | "upload" | "desktop";
export type RecordingStatus = "none" | "processing" | "generated" | "failed";
export type WorkspaceRole = "owner" | "admin" | "member";

// Personal: private to one user. Business: shared with invited teammates.
export type Workspace = { id: string; name: string; role: WorkspaceRole; isPersonal: boolean };

// A person as teammates see them (phone only when they share it).
export type PersonCard = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  company: string | null;
  phone: string | null;
  timezone: string | null;
  location: string | null;
  details: ProfileDetail[]; // shared extra fields (all of them on your own profile)
};

// Your own profile (settings page).
export type Profile = PersonCard & {
  phoneVisible: boolean;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
};

export type Recording = {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  title: string;
  source: RecordingSource;
  status: RecordingStatus;
  durationSec: number;
  createdAt: string; // ISO
  folderId: string | null;
  deletedAt: string | null;
};

export type Folder = { id: string; workspaceId: string; name: string };

export type Segment = { speaker: string; startSec: number; text: string };
export type Highlight = { id?: string; startSec: number; text: string; kind?: "note" | "flag" | "ai"; title?: string | null; bullets?: string[] };
export type SummarySection = { heading: string; bullets: string[] };
export type ActionItem = { id: string; text: string; done: boolean };
export type ActionGroup = { owner: string; role: string | null; items: ActionItem[] };

export type Summary = {
  template: string;
  model: string | null;
  overview: string;
  keyPoints: string[];
  actionGroups: ActionGroup[];
  mindMap: { root: string; branches: string[]; items?: VisualItem[] };
  dates?: MentionedDate[];
  visual?: VisualKind | null;
  title?: string | null;
  sections?: SummarySection[];
  language?: string | null;
  updatedAt?: string;
};

export type CalendarEvent = {
  id: string; workspaceId: string; recordingId: string | null; kind: MentionedDate["kind"]; title: string; startsAt: string; endsAt: string;
  allDay: boolean; location: string | null; notes: string | null; attendees: string[]; createdBy: string | null;
};

export type RecordingDetail = {
  recording: Recording;
  speakers: SpeakerMap;
  /** The recorder, assumed to be the voice that talks most. */
  owner: SpeakerInfo | null;
  events: CalendarEvent[];
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
