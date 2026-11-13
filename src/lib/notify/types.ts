// Notification events. The SQL triggers in
// supabase/migrations/20261031120000_notifications.sql create these types.

export const NOTIFICATION_TYPES = [
  { type: "transcript_ready", label: "Transcript ready", desc: "A recording you made has been transcribed." },
  { type: "transcript_failed", label: "Transcription failed", desc: "A recording couldn't be transcribed." },
  { type: "summary_ready", label: "Summary added", desc: "A summary was written for one of your recordings." },
  { type: "member_joined", label: "Teammate joined", desc: "Someone joined a Business workspace you manage." },
  { type: "recording_shared", label: "Recording shared with you", desc: "Someone shared one of their recordings with you." },
  { type: "redial_call", label: "Screened call", desc: "Your Redial assistant answered a call on your line." },
  { type: "agent_approval", label: "Agent approval requests", desc: "An AI agent you made is waiting for you to approve an action." },
  { type: "live_agent_review", label: "Live Agent profile review", desc: "The Redial team approved your Live Agent profile or asked for changes." },
  { type: "live_agent_message", label: "Live Agent messages", desc: "A business or Live Agent sent you a message." },
  { type: "live_agent_offer", label: "Live Agent offers", desc: "An offer or counter-offer for Live Agent work." },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["type"] | "test";
export type Channel = "in_app" | "email" | "sms" | "push";

export const CHANNELS: { key: Channel; label: string }[] = [
  { key: "in_app", label: "In-app" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "push", label: "Push" },
];

// A missing preference row means these.
export const DEFAULT_PREFS: Record<Channel, boolean> = { in_app: true, email: true, sms: false, push: false };

export type Preference = Record<Channel, boolean>;
