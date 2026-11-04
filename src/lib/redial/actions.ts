"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { VOICES, type Category, type ListKind, type Mode } from "./types";

// Member actions for Redial call screening. Everything runs as the signed-in
// member; RLS limits it to their own lines, lists, calls and callbacks.

type Result = { ok?: string; error?: string };
const done = (ok: string): Result => { revalidatePath("/calls"); return { ok }; };

export type LineSettings = {
  label: string; forward_to: string; mode: Mode; paused: boolean; allow_connect: boolean;
  assistant_name: string; voice: string; greeting: string; about: string; max_seconds: number;
};

export async function saveLine(lineId: string, s: LineSettings): Promise<Result> {
  await requireUser();
  const forward = s.forward_to.trim() ? toE164(s.forward_to) : null;
  if (s.forward_to.trim() && !forward) return { error: "Enter the phone number to ring, e.g. (480) 555-0142." };
  if (!["all", "unknown", "off"].includes(s.mode)) return { error: "Choose a screening mode." };
  if (!VOICES.some((v) => v.id === s.voice)) return { error: "Choose a voice." };
  if (!s.assistant_name.trim()) return { error: "Give your assistant a name." };
  const supabase = await createClient();
  const { data: line } = await supabase.from("redial_lines").select("number").eq("id", lineId).maybeSingle();
  if (!line) return { error: "Line not found." };
  if (forward === line.number) return { error: "That's your Redial number; calls would loop. Use your own cell number." };
  const { error } = await supabase.from("redial_lines").update({
    label: s.label.trim().slice(0, 60) || "My line", forward_to: forward, mode: s.mode, paused: s.paused, allow_connect: s.allow_connect,
    assistant_name: s.assistant_name.trim().slice(0, 40), voice: s.voice, greeting: s.greeting.trim().slice(0, 500) || null,
    about: s.about.trim().slice(0, 4000) || null, max_seconds: Math.min(300, Math.max(30, Math.round(s.max_seconds) || 120)),
  }).eq("id", lineId);
  return error ? { error: error.message } : done("Saved.");
}

export async function addListEntry(lineId: string, raw: string, kind: ListKind, label: string): Promise<Result> {
  await requireUser();
  const number = toE164(raw);
  if (!number) return { error: "Enter a valid phone number." };
  if (!["allow", "block", "vip"].includes(kind)) return { error: "Choose a list." };
  const supabase = await createClient();
  const { error } = await supabase.from("redial_list_entries").upsert({ line_id: lineId, number, kind, label: label.trim().slice(0, 100) || null }, { onConflict: "line_id,number" });
  return error ? { error: error.message } : done(kind === "block" ? "Blocked." : "Added.");
}

export async function removeListEntry(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("redial_list_entries").delete().eq("id", id);
  return error ? { error: error.message } : done("Removed.");
}

export async function updateCall(id: string, patch: { read?: boolean; archived?: boolean; category?: Category }): Promise<Result> {
  await requireUser();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {};
  if (patch.read !== undefined) row.read_at = patch.read ? now : null;
  if (patch.archived !== undefined) row.archived_at = patch.archived ? now : null;
  if (patch.category) row.category = patch.category;
  const supabase = await createClient();
  const { error } = await supabase.from("redial_calls").update(row).eq("id", id);
  return error ? { error: error.message } : done("Updated.");
}

export async function voicemailUrl(path: string): Promise<{ url?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("redial-voicemail").createSignedUrl(path, 600);
  return error || !data ? { error: "Couldn't load the recording." } : { url: data.signedUrl };
}

// due: "YYYY-MM-DDTHH:MM" in the given time zone.
export async function addCallback(input: { lineId: string; callId?: string | null; name: string; number: string; due: string; timezone: string; note: string }): Promise<Result> {
  await requireUser();
  const dueAt = zonedToUtc(input.due, input.timezone);
  if (!dueAt) return { error: "Choose a date and time." };
  const supabase = await createClient();
  const { error } = await supabase.from("redial_callbacks").insert({
    line_id: input.lineId, call_id: input.callId ?? null, name: input.name.trim().slice(0, 120) || null,
    number: (toE164(input.number) ?? input.number.trim()).slice(0, 40) || null, due_at: dueAt, timezone: input.timezone, note: input.note.trim().slice(0, 2000) || null,
  });
  return error ? { error: error.message } : done("Callback scheduled.");
}

export async function setCallbackDone(id: string, isDone: boolean): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("redial_callbacks").update({ done_at: isDone ? new Date().toISOString() : null }).eq("id", id);
  return error ? { error: error.message } : done(isDone ? "Done." : "Reopened.");
}

export async function deleteCallback(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("redial_callbacks").delete().eq("id", id);
  return error ? { error: error.message } : done("Deleted.");
}

// A wall-clock time in an IANA zone -> UTC ISO string.
function zonedToUtc(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asZone = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return new Date(guess - (asZone - guess)).toISOString();
  } catch {
    return null;
  }
}
