"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { twilioRequest, voiceToken } from "@/lib/comms/twilio";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { SHAREABLE } from "./features";
import { gatewayConfig, listenTicket } from "./gateway";
import { memberIdentity } from "./live";
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
  if (s.mode === "spam") return { error: "Screening suspected spam needs a spam-check service, which isn't connected yet." };
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

// Sharing a line: the owner grants someone in one of their workspaces
// specific capabilities (the database re-checks ownership and workspace).
// Anything else on a line needs seeing its calls, so read_summary comes along.
const cleanCaps = (caps: string[]) => {
  const ok = [...new Set(caps)].filter((c) => SHAREABLE.some((x) => x.id === c));
  return ok.length && !ok.includes("read_summary") ? ["read_summary", ...ok] : ok;
};

export async function shareLine(lineId: string, email: string, caps: string[]): Promise<Result> {
  await requireUser();
  const capabilities = cleanCaps(caps);
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { error: "Enter their email address." };
  if (!capabilities.length) return { error: "Choose at least one thing they can do." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("redial_grant", { p_line: lineId, p_email: email.trim(), p_capabilities: capabilities });
  return error ? { error: error.message } : done("Shared.");
}

// Losing the listen permission (or the share) drops them from any live call
// they're listening to, right away.
export async function updateShare(grantId: string, caps: string[]): Promise<Result> {
  await requireUser();
  const capabilities = cleanCaps(caps);
  if (!capabilities.length) return { error: "Leave at least one option on, or remove them." };
  const supabase = await createClient();
  const { data: grant } = await supabase.from("redial_line_grants").select("line_id, user_id").eq("id", grantId).maybeSingle();
  const listening = grant && !capabilities.includes("monitor_live") ? await listenersFor(supabase, grant.line_id, grant.user_id) : [];
  const { error } = await supabase.from("redial_line_grants").update({ capabilities }).eq("id", grantId);
  if (error) return { error: error.message };
  await Promise.all(listening.map(dropParticipant));
  return done("Updated.");
}

export async function removeShare(grantId: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { data: grant } = await supabase.from("redial_line_grants").select("line_id, user_id").eq("id", grantId).maybeSingle();
  const listening = grant ? await listenersFor(supabase, grant.line_id, grant.user_id) : [];
  const { error } = await supabase.from("redial_line_grants").delete().eq("id", grantId);
  if (error) return { error: error.message };
  await Promise.all(listening.map(dropParticipant));
  return done("Removed.");
}

// Calls happening now on a line, for the live view (polled while Calls is
// open). RLS limits it to lines the member can see; live transcript lines
// only come back with the read_transcript capability.
export type LiveParticipant = { id: string; role: string; status: string; muted: boolean; me: boolean };
export type LiveCall = {
  id: string; from_number: string | null; caller_id_name: string | null; caller_name: string | null; status: string; started_at: string;
  session: { state: string; ai_state: string; participants: LiveParticipant[] } | null;
  turns: { id: number; role: "caller" | "assistant"; text: string }[];
};

export async function liveCalls(lineId: string): Promise<LiveCall[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: calls } = await supabase.from("redial_calls").select("id, from_number, caller_id_name, caller_name, status, started_at")
    .eq("line_id", lineId).in("status", ["ringing", "screening", "connecting"]).gte("started_at", since).order("started_at", { ascending: false }).limit(5);
  if (!calls?.length) return [];
  const ids = calls.map((c) => c.id);
  const [{ data: sessions }, { data: turns }] = await Promise.all([
    supabase.from("redial_live_sessions").select("call_id, state, ai_state, participants:redial_live_participants(id, role, status, muted, user_id)").in("call_id", ids),
    supabase.from("redial_live_turns").select("id, call_id, role, text").in("call_id", ids).order("id").limit(400),
  ]);
  return calls.map((c) => {
    const s = sessions?.find((x) => x.call_id === c.id);
    return {
      ...c,
      session: s ? { state: s.state, ai_state: s.ai_state, participants: (s.participants ?? []).map(({ user_id, ...p }) => ({ ...p, me: user_id === user.id })) } : null,
      turns: (turns ?? []).filter((t) => t.call_id === c.id).map(({ id, role, text }) => ({ id, role: role as "caller" | "assistant", text })),
    };
  });
}

// Insider: a browser voice token and a two-minute ticket to join one live
// call as a muted listener. The joining webhook checks the permission again.
export async function startListening(callId: string): Promise<{ token?: string; ticket?: string; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: s } = await supabase.from("redial_live_sessions").select("id, line_id, state").eq("call_id", callId).maybeSingle();
  if (!s || s.state !== "live") return { error: "This call isn't live any more." };
  if (!(await canOnLine(supabase, s.line_id, user.id, "monitor_live"))) return { error: "You don't have permission to listen to this line's calls." };
  const gw = await gatewayConfig();
  const token = gw.aiApp && gw.secret ? await voiceToken(memberIdentity(user.id), { app: gw.aiApp, incoming: false }) : null;
  if (!token) return { error: "Live listening isn't set up yet (Twilio API key or the Redial TwiML App is missing)." };
  return { token, ticket: listenTicket(gw.secret!, s.id, user.id) };
}

// The owner removes someone who is listening to a call on their line.
export async function removeListener(participantId: string): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: p } = await supabase.from("redial_live_participants").select("call_sid, role, status, line_id, session:redial_live_sessions(conference_sid)").eq("id", participantId).maybeSingle();
  if (!p || p.role !== "member") return { error: "They're not on the call." };
  const { data: line } = await supabase.from("redial_lines").select("owner_id").eq("id", p.line_id).maybeSingle();
  if (line?.owner_id !== user.id) return { error: "Only the line's owner can remove listeners." };
  if (p.status === "joined") await dropParticipant({ call_sid: p.call_sid, conference_sid: confSid(p.session) });
  return { ok: "Removed from the call." };
}

type Listener = { call_sid: string; conference_sid: string | null };
type Db = Awaited<ReturnType<typeof createClient>>;
const confSid = (session: unknown) => (session as { conference_sid: string | null } | null)?.conference_sid ?? null;

async function canOnLine(supabase: Db, lineId: string, userId: string, cap: string) {
  const [{ data: line }, { data: grant }] = await Promise.all([
    supabase.from("redial_lines").select("owner_id").eq("id", lineId).maybeSingle(),
    supabase.from("redial_line_grants").select("capabilities").eq("line_id", lineId).eq("user_id", userId).maybeSingle(),
  ]);
  return line?.owner_id === userId || Boolean(grant?.capabilities?.includes(cap));
}

async function listenersFor(supabase: Db, lineId: string, userId: string): Promise<Listener[]> {
  const { data } = await supabase.from("redial_live_participants").select("call_sid, session:redial_live_sessions(conference_sid)")
    .eq("line_id", lineId).eq("user_id", userId).eq("role", "member").eq("status", "joined");
  return (data ?? []).map((p) => ({ call_sid: p.call_sid, conference_sid: confSid(p.session) }));
}

// Removes a participant from the conference; the conference webhook records it.
async function dropParticipant(l: Listener) {
  const r = l.conference_sid
    ? await twilioRequest(`/Conferences/${l.conference_sid}/Participants/${l.call_sid}.json`, {}, "DELETE")
    : await twilioRequest(`/Calls/${l.call_sid}.json`, { Status: "completed" });
  if (!r.ok && r.status !== 404) console.error("[redial listener]", r.status, r.data.message);
}
