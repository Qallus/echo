import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { MIRROR_DEFAULTS, type MirrorSettings } from "./mirror";
import type { Access, Call, Callback, EchoCall, Line, ListEntry, Turn } from "./types";

// Redial reads for the signed-in member. RLS limits them to lines they own or
// were granted; transcripts come through redial_transcripts(), which checks
// the read_transcript capability.

const CALL_COLS = "id, line_id, from_number, caller_id_name, status, reason, caller_name, purpose, callback_number, message, summary, category, urgency, duration_seconds, recording_path, started_at, ended_at, read_at, archived_at";
// The call log's columns (migration 20261116150000); used when they exist.
const LOG_COLS = `${CALL_COLS}, direction, to_number, recording_id, cost_cents, notes, verdict, risk_signals`;

type Db = Awaited<ReturnType<typeof createClient>>;
async function lineCalls(supabase: Db, lineId: string) {
  const full = await supabase.from("redial_calls").select(LOG_COLS).eq("line_id", lineId).order("started_at", { ascending: false }).limit(200);
  if (!full.error) return full;
  return supabase.from("redial_calls").select(CALL_COLS).eq("line_id", lineId).order("started_at", { ascending: false }).limit(200);
}

// Each call's Echo recording: status, summary overview and action items.
async function echoFor(supabase: Db, ids: string[]): Promise<Map<string, EchoCall>> {
  if (!ids.length) return new Map();
  const [recs, sums, acts] = await Promise.all([
    supabase.from("recordings").select("id, status").in("id", ids),
    supabase.from("summaries").select("recording_id, overview").in("recording_id", ids),
    supabase.from("action_items").select("recording_id, text, done, position").in("recording_id", ids).order("position"),
  ]);
  const map = new Map<string, EchoCall>();
  for (const r of recs.data ?? []) map.set(r.id, { id: r.id, status: r.status, overview: null, actions: [] });
  for (const s of sums.data ?? []) { const e = map.get(s.recording_id); if (e) e.overview = s.overview || null; }
  for (const a of acts.data ?? []) map.get(a.recording_id)?.actions.push({ text: a.text, done: a.done });
  return map;
}

// For the sidebar: null when the member has no Redial line (owned or shared).
export async function callsBadge(): Promise<number | null> {
  const lines = await myLines();
  if (!lines.length) return null;
  const supabase = await createClient();
  const { count } = await supabase.from("redial_calls").select("id", { count: "exact", head: true })
    .in("line_id", lines.map((l) => l.id)).is("read_at", null).is("archived_at", null).in("status", ["message", "completed", "missed", "connected"]);
  return count ?? 0;
}

// Lines the member owns or has been granted, with what they may do on each.
// (Staff can also read line rows in admin; those aren't "my" lines.)
export async function myLines(): Promise<(Line & { access: Access })[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];
  const [{ data: owned }, { data: grants }] = await Promise.all([
    supabase.from("redial_lines").select("*").eq("owner_id", user.id).order("created_at"),
    supabase.from("redial_line_grants").select("line_id, capabilities").eq("user_id", user.id),
  ]);
  const shared = grants?.length
    ? (await supabase.from("redial_lines").select("*").in("id", grants.map((g) => g.line_id)).order("created_at")).data ?? []
    : [];
  return [
    ...((owned ?? []) as Line[]).map((l) => ({ ...l, access: { owner: true, capabilities: [] } })),
    ...(shared as Line[]).map((l) => ({ ...l, access: { owner: false, capabilities: grants!.find((g) => g.line_id === l.id)?.capabilities ?? [] } })),
  ];
}

// The Phone across every line the member can see (Admin -> Communications):
// all their calls, newest first, and each line's lists.
export async function phoneCenterData() {
  const lines = await myLines();
  const details = await Promise.all(lines.map((l) => lineDetail(l.id, l.access)));
  return {
    lines: lines as Line[],
    calls: details.flatMap((d) => d.calls).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    entries: details.flatMap((d) => d.entries),
    manageLines: lines.filter((l) => l.access.owner).map((l) => l.id),
  };
}

export async function lineDetail(lineId: string, access: Access) {
  const supabase = await createClient();
  const directoryAccess = access.owner || access.capabilities.includes("transfer_call") || access.capabilities.includes("manage_directory");
  const [calls, entries, callbacks, people, directory, mirror] = await Promise.all([
    lineCalls(supabase, lineId),
    supabase.from("redial_list_entries").select("id, line_id, number, kind, label, created_at").eq("line_id", lineId).order("created_at", { ascending: false }),
    supabase.from("redial_callbacks").select("id, line_id, call_id, name, number, due_at, timezone, note, done_at").eq("line_id", lineId).order("due_at"),
    access.owner ? supabase.rpc("redial_line_people", { p_line: lineId }) : Promise.resolve({ data: [] }),
    directoryAccess ? supabase.from("redial_directory").select("id, label, number, note, sort").eq("line_id", lineId).order("sort").order("label") : Promise.resolve({ data: [] }),
    supabase.from("redial_mirror_settings").select("*").eq("line_id", lineId).maybeSingle(),
  ]);
  const rows = (calls.data ?? []) as Omit<Call, "transcript">[];
  const canRead = access.owner || access.capabilities.includes("read_transcript");
  const { data: transcripts } = canRead && rows.length
    ? await supabase.rpc("redial_transcripts", { p_line: lineId, p_ids: rows.map((c) => c.id) })
    : { data: [] };
  const byId = new Map(((transcripts ?? []) as { id: string; transcript: Turn[] }[]).map((t) => [t.id, t.transcript]));
  const echo = await echoFor(supabase, rows.map((c) => c.recording_id).filter((x): x is string => Boolean(x)));
  return {
    calls: rows.map((c) => ({ ...c, transcript: byId.get(c.id) ?? [], echo: c.recording_id ? echo.get(c.recording_id) ?? null : null })) as Call[],
    entries: (entries.data ?? []) as ListEntry[],
    callbacks: (callbacks.data ?? []) as Callback[],
    people: (people.data ?? []) as LinePerson[],
    directory: (directory.data ?? []) as DirectoryEntry[],
    mirror: { ...MIRROR_DEFAULTS, line_id: lineId, ...(mirror.data ?? {}) } as MirrorSettings,
  };
}

// Fraud protection for a line (its owner): settings, family, trusted contacts.
export type ProtectionData = {
  settings: { enabled: boolean; has_code_word: boolean; auto_block_scams: boolean; warn_on_courier: boolean };
  family: { id: string; name: string; relationship: string | null; phone: string | null; callback_ok: boolean }[];
  trusted: { id: string; name: string; phone: string | null; email: string | null; alert_scams: boolean; weekly_summary: boolean; invited_at: string | null; sms_consent_at: string | null; opted_out_at: string | null }[];
};
export async function lineProtectionData(lineId: string): Promise<ProtectionData> {
  const supabase = await createClient();
  const [s, f, t] = await Promise.all([
    supabase.from("redial_protection").select("enabled, has_code_word, auto_block_scams, warn_on_courier").eq("line_id", lineId).maybeSingle(),
    supabase.from("redial_family").select("id, name, relationship, phone, callback_ok").eq("line_id", lineId).order("created_at"),
    supabase.from("redial_trusted_contacts").select("id, name, phone, email, alert_scams, weekly_summary, invited_at, sms_consent_at, opted_out_at").eq("line_id", lineId).order("created_at"),
  ]);
  return {
    settings: s.data ?? { enabled: true, has_code_word: false, auto_block_scams: true, warn_on_courier: true },
    family: (f.data ?? []) as ProtectionData["family"], trusted: (t.data ?? []) as ProtectionData["trusted"],
  };
}

export type DirectoryEntry = { id: string; label: string; number: string; note: string | null; sort: number };
export type LinePerson = { grant_id: string; user_id: string; email: string; full_name: string | null; capabilities: string[]; created_at: string };
