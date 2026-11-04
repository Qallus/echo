import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Call, Callback, Line, ListEntry } from "./types";

// Redial reads for the signed-in member (RLS: only their own lines and calls).

// For the sidebar: null when the member has no Redial line.
export async function callsBadge(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { count: lines } = await supabase.from("redial_lines").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  if (!lines) return null;
  const { count } = await supabase.from("redial_calls").select("id", { count: "exact", head: true })
    .eq("owner_id", user.id).is("read_at", null).is("archived_at", null).in("status", ["message", "completed", "missed", "connected"]);
  return count ?? 0;
}

export async function myLines(): Promise<Line[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("redial_lines").select("*").eq("owner_id", user.id).order("created_at");
  return (data ?? []) as Line[];
}

export async function lineDetail(lineId: string) {
  const supabase = await createClient();
  const [calls, entries, callbacks] = await Promise.all([
    supabase.from("redial_calls").select("id, line_id, from_number, caller_id_name, status, reason, caller_name, purpose, callback_number, message, summary, category, urgency, transcript, duration_seconds, recording_path, started_at, ended_at, read_at, archived_at")
      .eq("line_id", lineId).order("started_at", { ascending: false }).limit(200),
    supabase.from("redial_list_entries").select("id, line_id, number, kind, label, created_at").eq("line_id", lineId).order("created_at", { ascending: false }),
    supabase.from("redial_callbacks").select("id, line_id, call_id, name, number, due_at, timezone, note, done_at").eq("line_id", lineId).order("due_at"),
  ]);
  return { calls: (calls.data ?? []) as Call[], entries: (entries.data ?? []) as ListEntry[], callbacks: (callbacks.data ?? []) as Callback[] };
}
