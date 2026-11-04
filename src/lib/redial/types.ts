// Redial call screening: lines, lists, calls and the routing decision.
// Mirrors supabase/migrations/20261104120000_redial_screening.sql. decide()
// is shared by the live webhook and the rules simulator so they agree.

export type Mode = "spam" | "all" | "unknown" | "off";
export type ListKind = "allow" | "block" | "vip";
export type CallStatus = "ringing" | "screening" | "connecting" | "connected" | "message" | "blocked" | "forwarded" | "missed" | "failed" | "completed";
export type Category = "personal" | "business" | "sales" | "spam" | "unknown";

export type Line = {
  id: string; owner_id: string; label: string; number: string; forward_to: string | null; mode: Mode; paused: boolean; allow_connect: boolean;
  assistant_name: string; voice: string; greeting: string | null; about: string | null; max_seconds: number;
};
export type ListEntry = { id: string; line_id: string; number: string; kind: ListKind; label: string | null; created_at: string };
export type Turn = { role: "caller" | "assistant"; text: string };
export type Call = {
  id: string; line_id: string; from_number: string | null; caller_id_name: string | null; status: CallStatus; reason: string | null;
  caller_name: string | null; purpose: string | null; callback_number: string | null; message: string | null; summary: string | null;
  category: Category | null; urgency: "low" | "normal" | "high" | null; transcript: Turn[]; duration_seconds: number | null;
  recording_path: string | null; started_at: string; ended_at: string | null; read_at: string | null; archived_at: string | null;
};
// What the signed-in person may do on a line: everything for the owner,
// otherwise what the owner granted (redial_line_grants).
export type Access = { owner: boolean; capabilities: string[] };
export const allows = (a: Access, cap: string) => a.owner || a.capabilities.includes(cap);
export type Callback = { id: string; line_id: string; call_id: string | null; name: string | null; number: string | null; due_at: string; timezone: string; note: string | null; done_at: string | null };

// `needsSpamCheck`: only offered once a spam-reputation provider is connected.
export const MODES: { id: Mode; label: string; detail: string; needsSpamCheck?: boolean }[] = [
  { id: "spam", label: "Screen suspected spam", detail: "Your assistant answers calls a spam check flags. Everyone else rings straight through.", needsSpamCheck: true },
  { id: "unknown", label: "Screen unknown callers", detail: "Numbers on your allow or VIP list ring straight through. Everyone else talks to your assistant first." },
  { id: "all", label: "Screen every call", detail: "Your assistant answers every call except VIPs." },
  { id: "off", label: "Don't screen", detail: "Calls ring straight through (blocked numbers are still blocked). If you don't answer, the caller can leave a message." },
];

export const VOICES = [
  { id: "ara", label: "Ara", detail: "Warm and friendly" }, { id: "eve", label: "Eve", detail: "Bright and upbeat" },
  { id: "rex", label: "Rex", detail: "Calm and confident" }, { id: "sal", label: "Sal", detail: "Smooth and even" },
  { id: "leo", label: "Leo", detail: "Clear and direct" },
] as const;

export const STATUS_LABEL: Record<CallStatus, string> = {
  ringing: "Ringing", screening: "Screening", connecting: "Connecting", connected: "Put through", message: "Message",
  blocked: "Blocked", forwarded: "Rang through", missed: "Missed", failed: "Failed", completed: "Screened",
};

export const CATEGORY_LABEL: Record<Category, string> = { personal: "Personal", business: "Business", sales: "Sales", spam: "Likely spam", unknown: "Unknown" };

export type Decision = { action: "block" | "forward" | "screen" | "voicemail"; reason: string };

// Precedence: paused -> blocked -> VIP -> mode off -> spam mode -> known
// caller (unknown mode) -> screen. Caller ID is a signal, not proof, so it
// only routes; it never unlocks anything. `spam` is the spam check's verdict:
// null when no spam-check provider is connected (missing evidence is never
// treated as spam).
export function decide(line: Pick<Line, "forward_to" | "mode" | "paused">, from: string | null, entries: Pick<ListEntry, "number" | "kind">[], spam: boolean | null = null): Decision {
  const hit = from ? entries.find((e) => e.number === from) : undefined;
  const ring = (reason: string): Decision => (line.forward_to ? { action: "forward", reason } : { action: "voicemail", reason: `${reason}; no number to ring, so voicemail` });
  if (line.paused) return ring("Screening is paused");
  if (hit?.kind === "block") return { action: "block", reason: "On your block list" };
  if (hit?.kind === "vip") return ring("VIP");
  if (line.mode === "off") return ring("Screening is off");
  if (line.mode === "spam") {
    if (spam === null) return ring("Spam check isn't connected");
    return spam ? { action: "screen", reason: "Suspected spam" } : ring("Not flagged as spam");
  }
  if (!from) return { action: "screen", reason: "No caller ID" };
  if (line.mode === "unknown" && hit?.kind === "allow") return ring("On your allow list");
  return { action: "screen", reason: line.mode === "all" ? "Screening every call" : "Unknown caller" };
}

// Same rules as toE164 in lib/notify/senders (server-only), for the browser.
export function normalizeNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const d = digits.replace(/\+/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}
