import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MIRROR_DEFAULTS, type MirrorSettings } from "./mirror";
import type { Access, Call, Callback, Line, ListEntry, Turn } from "./types";

// Redial reads for the signed-in member. RLS limits them to lines they own or
// were granted; transcripts come through redial_transcripts(), which checks
// the read_transcript capability.

const CALL_COLS = "id, line_id, from_number, caller_id_name, status, reason, caller_name, purpose, callback_number, message, summary, category, urgency, duration_seconds, recording_path, started_at, ended_at, read_at, archived_at";

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
  const { data: { user } } = await supabase.auth.getUser();
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

export async function lineDetail(lineId: string, access: Access) {
  const supabase = await createClient();
  const directoryAccess = access.owner || access.capabilities.includes("transfer_call") || access.capabilities.includes("manage_directory");
  const [calls, entries, callbacks, people, directory, mirror] = await Promise.all([
    supabase.from("redial_calls").select(CALL_COLS).eq("line_id", lineId).order("started_at", { ascending: false }).limit(200),
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
  return {
    calls: rows.map((c) => ({ ...c, transcript: byId.get(c.id) ?? [] })) as Call[],
    entries: (entries.data ?? []) as ListEntry[],
    callbacks: (callbacks.data ?? []) as Callback[],
    people: (people.data ?? []) as LinePerson[],
    directory: (directory.data ?? []) as DirectoryEntry[],
    mirror: { ...MIRROR_DEFAULTS, line_id: lineId, ...(mirror.data ?? {}) } as MirrorSettings,
  };
}

export type DirectoryEntry = { id: string; label: string; number: string; note: string | null; sort: number };
export type LinePerson = { grant_id: string; user_id: string; email: string; full_name: string | null; capabilities: string[]; created_at: string };
