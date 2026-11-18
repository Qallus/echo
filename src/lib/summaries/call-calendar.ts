import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentionedDate } from "@/lib/visuals";

// Appointments, events and deadlines mentioned on a Redial phone call go
// straight onto the calendar of the call's workspace (the summary has already
// worked out the real dates). Only the first time a call is summarized, so
// events people edit or delete aren't brought back by a re-summary.

// The UTC instant for a wall-clock time in a time zone.
export function zonedToUtc(day: string, time: string, tz: string): Date {
  const guess = new Date(`${day}T${time}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

export async function addCallDatesToCalendar(db: SupabaseClient, recordingId: string, dates: MentionedDate[]) {
  if (!dates.length) return;
  const { data: call } = await db.from("redial_calls").select("id, from_number, line:redial_lines(label)").eq("recording_id", recordingId).maybeSingle();
  if (!call) return; // not a Redial call
  const [{ data: rec }, { count }] = await Promise.all([
    db.from("recordings").select("workspace_id, created_by").eq("id", recordingId).maybeSingle(),
    db.from("calendar_events").select("id", { count: "exact", head: true }).eq("recording_id", recordingId),
  ]);
  if (!rec || (count ?? 0) > 0) return;
  const { data: prof } = rec.created_by ? await db.from("profiles").select("timezone").eq("id", rec.created_by).maybeSingle() : { data: null };
  const tz = prof?.timezone || "America/Phoenix";
  const caller = call.from_number ? ` with ${call.from_number}` : "";
  const rows = dates.slice(0, 10).map((d) => {
    const start = d.start ? zonedToUtc(d.date, d.start, tz) : zonedToUtc(d.date, "00:00", tz);
    const end = d.start
      ? (d.end ? zonedToUtc(d.endDate ?? d.date, d.end, tz) : new Date(start.getTime() + 30 * 60_000))
      : zonedToUtc(d.endDate ?? d.date, "23:59", tz);
    return {
      workspace_id: rec.workspace_id, recording_id: recordingId, kind: d.kind, title: d.title.slice(0, 200),
      starts_at: start.toISOString(), ends_at: (end < start ? start : end).toISOString(), all_day: !d.start, location: d.location,
      notes: [`From a call${caller}.`, d.quote ? `“${d.quote}”` : ""].filter(Boolean).join("\n").slice(0, 5000),
      attendees: d.people.map((name) => name.slice(0, 120)).slice(0, 30), created_by: rec.created_by,
    };
  });
  const { error } = await db.from("calendar_events").insert(rows);
  if (error) console.error("[call calendar]", recordingId, error.message);
}
