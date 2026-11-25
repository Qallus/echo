import "server-only";
import { countUnreadNotifications, getMyProfile, listCalendarEvents, listRecordings, requireUser } from "@/lib/data";
import { listThreads } from "@/lib/live-agents/messages";
import { myHiredAgents } from "@/lib/live-agents/my-agents";
import { myLines } from "@/lib/redial/data";
import { columnReady } from "@/lib/schema-ready";
import { lineSmsUsage } from "@/lib/sms/server";
import { createClient } from "@/lib/supabase/server";
import { normalize, type Layout } from "./layout";

// Everything the Home dashboard's cards show, read once per page load with
// the person's own client (RLS). A source that isn't set up yet is null, and
// its card says so instead of failing.

export type Count = { now: number; last: number };
export type DayPoint = { day: string; a: number; b: number };
export type CallRow = { id: string; who: string; number: string | null; direction: "inbound" | "outbound"; status: string; at: string; unread: boolean };
export type TextRow = { id: string; number: string; body: string; direction: "inbound" | "outbound"; at: string; unread: boolean };
export type EventRow = { id: string; title: string; kind: string; startsAt: string; endsAt: string; allDay: boolean; location: string | null };
export type FileRow = { id: string; title: string; source: string; createdAt: string; durationSec: number; status: string };

export type DashboardData = {
  userId: string;
  firstName: string;
  location: string | null;
  timezone: string | null;
  hasLine: boolean;
  lineIds: string[];
  /** Lines you own (calls go out from these). */
  ownLines: { id: string; number: string; label: string; record: boolean }[];
  calls: { total: Count; inbound: Count; outbound: Count; missed: Count; monitored: Count; alerts: Count; outcomes: { name: string; value: number }[]; series: DayPoint[]; recent: CallRow[] } | null;
  texts: { sent: Count; received: Count; left: number | null; allowance: number | null; series: DayPoint[]; recent: TextRow[] } | null;
  recordings: { count: Count; minutes: Count; series: DayPoint[]; recent: FileRow[] };
  files: { live: number; archived: number; trash: number };
  calendar: { week: number; bookings: Count; upcoming: EventRow[]; month: EventRow[] };
  notifications: { unread: number };
  messages: { unread: number } | null;
  emails: Count | null;
  agents: { id: string; name: string; avatarUrl: string | null; standing: string; threadId: string; work: string }[];
};

const iso = (d: Date) => d.toISOString();
const dayKey = (d: Date) => d.toLocaleDateString("en-CA");

export async function loadDashboardData(): Promise<DashboardData> {
  const user = await requireUser();
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirty = new Date(now.getTime() - 29 * 86400_000);
  thirty.setHours(0, 0, 0, 0);
  const seriesFrom = thirty < lastStart ? thirty : lastStart;
  const inMonth = (at: string) => at >= iso(monthStart);
  const inLast = (at: string) => at >= iso(lastStart) && at < iso(monthStart);
  const count = <T,>(rows: T[], at: (r: T) => string, test: (r: T) => boolean = () => true): Count =>
    ({ now: rows.filter((r) => test(r) && inMonth(at(r))).length, last: rows.filter((r) => test(r) && inLast(at(r))).length });
  const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(thirty.getTime() + i * 86400_000)));
  const series = <T,>(rows: T[], at: (r: T) => string, a: (r: T) => boolean, b: (r: T) => boolean): DayPoint[] =>
    days.map((day) => {
      const on = rows.filter((r) => dayKey(new Date(at(r))) === day);
      return { day, a: on.filter(a).length, b: on.filter(b).length };
    });

  const weekEnd = new Date(now.getTime() + 7 * 86400_000);
  const [profile, lines, recordings, events, unread, threads] = await Promise.all([
    getMyProfile(), myLines(), listRecordings(),
    listCalendarEvents(iso(lastStart), iso(new Date(now.getFullYear(), now.getMonth() + 2, 1))).catch(() => []),
    countUnreadNotifications(), listThreads().catch(() => null),
  ]);
  const hired = await myHiredAgents().catch(() => []);
  const lineIds = lines.map((l) => l.id);

  // Calls on your lines.
  let calls: DashboardData["calls"] = null;
  if (lineIds.length) {
    const { data } = await supabase.from("redial_calls")
      .select("id, direction, status, ai_seconds, verdict, started_at, read_at, caller_name, caller_id_name, from_number, to_number")
      .in("line_id", lineIds).gte("started_at", iso(seriesFrom)).order("started_at", { ascending: false }).limit(5000);
    type C = { id: string; direction: string | null; status: string; ai_seconds: number | null; verdict: string | null; started_at: string; read_at: string | null; caller_name: string | null; caller_id_name: string | null; from_number: string | null; to_number: string | null };
    const rows = (data ?? []) as C[];
    const out = (r: C) => r.direction === "outbound";
    const at = (r: C) => r.started_at;
    const missed = (r: C) => !out(r) && ["missed", "message"].includes(r.status);
    const thisMonth = rows.filter((r) => inMonth(r.started_at));
    const outcome = (r: C) => (out(r) ? "Outbound" : r.status === "blocked" ? "Blocked" : missed(r) ? "Missed / message" : r.status === "forwarded" ? "Forwarded" : "Answered");
    const outcomes = [...thisMonth.reduce((m, r) => m.set(outcome(r), (m.get(outcome(r)) ?? 0) + 1), new Map<string, number>())].map(([name, value]) => ({ name, value }));
    calls = {
      total: count(rows, at), inbound: count(rows, at, (r) => !out(r)), outbound: count(rows, at, out), missed: count(rows, at, missed),
      monitored: count(rows, at, (r) => (r.ai_seconds ?? 0) > 0), alerts: count(rows, at, (r) => r.verdict === "likely_scam"),
      outcomes, series: series(rows, at, (r) => !out(r), out),
      recent: rows.slice(0, 8).map((r) => ({
        id: r.id, who: out(r) ? r.to_number ?? "Unknown" : r.caller_name || r.caller_id_name || r.from_number || "Unknown",
        number: out(r) ? r.to_number : r.from_number, direction: out(r) ? "outbound" : "inbound", status: r.status, at: r.started_at,
        unread: !out(r) && !r.read_at,
      })),
    };
  }

  // Texts on your lines.
  let texts: DashboardData["texts"] = null;
  if (lineIds.length && (await columnReady("phone_messages", "line_id"))) {
    const { data } = await supabase.from("phone_messages").select("id, direction, from_number, to_number, body, read_at, created_at")
      .in("line_id", lineIds).gte("created_at", iso(seriesFrom)).order("created_at", { ascending: false }).limit(5000);
    type T = { id: string; direction: string; from_number: string; to_number: string; body: string; read_at: string | null; created_at: string };
    const rows = (data ?? []) as T[];
    const at = (r: T) => r.created_at;
    const own = lines.find((l) => l.access.owner) ?? lines[0];
    const usage = await lineSmsUsage(supabase, own.id);
    const seen = new Set<string>();
    texts = {
      sent: count(rows, at, (r) => r.direction === "outbound"), received: count(rows, at, (r) => r.direction === "inbound"),
      left: usage?.remaining ?? null, allowance: usage?.allowance ?? null,
      series: series(rows, at, (r) => r.direction === "outbound", (r) => r.direction === "inbound"),
      recent: rows.flatMap((r) => {
        const number = r.direction === "inbound" ? r.from_number : r.to_number;
        if (seen.has(number) || seen.size >= 6) return [];
        seen.add(number);
        return [{ id: r.id, number, body: r.body, direction: r.direction === "inbound" ? "inbound" as const : "outbound" as const, at: r.created_at, unread: r.direction === "inbound" && !r.read_at }];
      }),
    };
  }

  // Recordings and files.
  const live = recordings.filter((r) => !r.deletedAt && !r.archivedAt);
  const recAt = (r: (typeof recordings)[number]) => r.createdAt;
  const sumMin = (test: (at: string) => boolean) => Math.round(recordings.filter((r) => !r.deletedAt && test(r.createdAt)).reduce((n, r) => n + r.durationSec, 0) / 60);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(now.getTime() - (11 - i) * 7 * 86400_000);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
  });
  const recSeries = weeks.map((w, i) => {
    const end = weeks[i + 1] ?? new Date(now.getTime() + 86400_000);
    const on = recordings.filter((r) => !r.deletedAt && r.createdAt >= iso(w) && r.createdAt < iso(end));
    return { day: dayKey(w), a: on.length, b: Math.round(on.reduce((n, r) => n + r.durationSec, 0) / 60) };
  });

  // Calendar: this week, bookings (appointments) this month, what's next.
  const ev = events.map((e) => ({ id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, allDay: e.allDay, location: e.location }));
  const upcoming = ev.filter((e) => e.endsAt >= iso(now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  // Live Agent messages and emails.
  const messages = threads ? { unread: threads.reduce((n, t) => n + (t.unread ? 1 : 0), 0) } : null;
  let emails: Count | null = null;
  if (await columnReady("workspace_emails", "id")) {
    const { data } = await supabase.from("workspace_emails").select("created_at").eq("sent_by", user.id).eq("status", "sent").gte("created_at", iso(lastStart)).limit(5000);
    emails = count((data ?? []) as { created_at: string }[], (r) => r.created_at);
  }

  return {
    userId: user.id,
    firstName: profile.fullName?.trim().split(/\s+/)[0] ?? "",
    location: profile.location, timezone: profile.timezone,
    hasLine: lineIds.length > 0, lineIds,
    ownLines: lines.filter((l) => l.access.owner).map((l) => ({ id: l.id, number: l.number, label: l.label, record: Boolean(l.record_calls) })),
    calls, texts,
    recordings: {
      count: count(recordings.filter((r) => !r.deletedAt), recAt), minutes: { now: sumMin(inMonth), last: sumMin(inLast) }, series: recSeries,
      recent: live.slice(0, 8).map((r) => ({ id: r.id, title: r.title, source: r.source, createdAt: r.createdAt, durationSec: r.durationSec, status: r.status })),
    },
    files: { live: live.length, archived: recordings.filter((r) => !r.deletedAt && r.archivedAt).length, trash: recordings.filter((r) => r.deletedAt).length },
    calendar: {
      week: ev.filter((e) => e.startsAt >= iso(now) && e.startsAt < iso(weekEnd)).length,
      bookings: count(ev.filter((e) => e.kind === "appointment"), (e) => e.startsAt),
      upcoming: upcoming.slice(0, 12), month: ev,
    },
    notifications: { unread },
    messages, emails,
    agents: hired.filter((a) => a.standing !== "past").slice(0, 8).map((a) => ({ id: a.id, name: a.name, avatarUrl: a.avatarUrl, standing: a.standing, threadId: a.threadId, work: a.work })),
  };
}

/** The saved layout (null: never set up, or before the dashboard migration). */
export async function loadDashboardLayout(): Promise<{ layout: Layout | null; stored: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_dashboards").select("layout").eq("user_id", user.id).maybeSingle();
  if (error) return { layout: null, stored: false };
  return { layout: normalize(data?.layout), stored: true };
}
