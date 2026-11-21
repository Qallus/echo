import "server-only";
import { accessToken, CONNECTION_COLS, GoogleAuthError, type Connection } from "./oauth";
import type { createClient } from "@/lib/supabase/server";

// Two-way sync between a person's Redial calendar (one workspace, Personal by
// default) and their Google Calendar. Runs as the signed-in person.
// - push: a Redial event saved or deleted goes to Google right away.
// - sync: send Redial events Google hasn't seen (or that changed), then pull
//   Google's changes since the last sync (incremental sync token).
// When both sides changed the same event, the newer edit wins.
// Redial never sends invitations: attendees stay as names in the notes.

type Db = Awaited<ReturnType<typeof createClient>>;
type LocalEvent = {
  id: string; workspace_id: string; title: string; starts_at: string; ends_at: string; all_day: boolean;
  location: string | null; notes: string | null; attendees: unknown; updated_at: string;
};
type GoogleEvent = {
  id: string; status?: string; summary?: string; description?: string; location?: string; updated?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string }; end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};
type Link = { connection_id: string; event_id: string; google_event_id: string; google_updated: string | null; synced_at: string };

const API = "https://www.googleapis.com/calendar/v3";
const LOCAL_COLS = "id, workspace_id, title, starts_at, ends_at, all_day, location, notes, attendees, updated_at";
const MARK = "\n\nWith: ";
// Database and Google timestamps differ in format, so compare as times.
const ms = (s: string | null | undefined) => (s ? Date.parse(s) : 0);

// ---------------------------------------------------------------------------
// Time zones (all-day events are dates in the person's time zone)
// ---------------------------------------------------------------------------
const dayIn = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function zoned(day: string, time: string, tz: string) {
  const guess = Date.parse(`${day}T${time}:00Z`);
  const offset = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first)).toISOString();
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------
function toGoogle(e: LocalEvent, tz: string) {
  const people = Array.isArray(e.attendees) ? e.attendees.filter((a): a is string => typeof a === "string") : [];
  const description = [e.notes ?? "", people.length ? `${MARK}${people.join(", ")}` : ""].join("").trim() || undefined;
  const timing = e.all_day
    ? { start: { date: dayIn(e.starts_at, tz) }, end: { date: addDays(dayIn(e.ends_at > e.starts_at ? e.ends_at : e.starts_at, tz), 1) } }
    : { start: { dateTime: e.starts_at }, end: { dateTime: e.ends_at } };
  return { summary: e.title, location: e.location ?? undefined, description, ...timing, extendedProperties: { private: { redialEventId: e.id } } };
}

function fromGoogle(g: GoogleEvent, tz: string) {
  const allDay = Boolean(g.start?.date);
  const start = allDay ? zoned(g.start!.date!, "00:00", tz) : g.start?.dateTime ? new Date(g.start.dateTime).toISOString() : null;
  const endDay = g.end?.date ? addDays(g.end.date, -1) : null;
  const end = allDay ? zoned(endDay && endDay >= g.start!.date! ? endDay : g.start!.date!, "23:59", tz) : g.end?.dateTime ? new Date(g.end.dateTime).toISOString() : start;
  if (!start || !end) return null;
  const [notes, people] = (g.description ?? "").split(MARK);
  return {
    title: (g.summary?.trim() || "(No title)").slice(0, 200), starts_at: start, ends_at: end < start ? start : end, all_day: allDay,
    location: g.location?.trim().slice(0, 300) || null, notes: notes?.trim().slice(0, 5000) || null,
    attendees: people ? people.split(",").map((p) => p.trim().slice(0, 120)).filter(Boolean).slice(0, 30) : [],
  };
}

// ---------------------------------------------------------------------------
// Google API
// ---------------------------------------------------------------------------
async function call(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, cache: "no-store", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers } });
  return res;
}
const calPath = (c: Connection) => `/calendars/${encodeURIComponent(c.calendar_id)}/events`;

async function pushOne(db: Db, c: Connection, token: string, e: LocalEvent, link: Link | undefined, tz: string) {
  const body = JSON.stringify(toGoogle(e, tz));
  let res = link
    ? await call(token, `${calPath(c)}/${encodeURIComponent(link.google_event_id)}`, { method: "PATCH", body })
    : await call(token, calPath(c), { method: "POST", body });
  if (link && (res.status === 404 || res.status === 410)) res = await call(token, calPath(c), { method: "POST", body }); // deleted in Google: recreate
  if (!res.ok) throw new Error(`Google Calendar said ${res.status} for "${e.title}".`);
  const g = (await res.json()) as GoogleEvent;
  await db.from("calendar_sync_links").upsert({ connection_id: c.id, event_id: e.id, google_event_id: g.id, google_updated: g.updated ?? null, synced_at: new Date().toISOString() });
}

async function timezoneOf(db: Db, userId: string) {
  const { data } = await db.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = data?.timezone || "America/Phoenix";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "America/Phoenix"; }
}

async function connectionFor(db: Db, userId: string): Promise<Connection | null> {
  const { data } = await db.from("account_connections").select(CONNECTION_COLS).eq("user_id", userId).eq("provider", "google").maybeSingle();
  return (data as Connection | null) ?? null;
}

// ---------------------------------------------------------------------------
// Push on save / delete (called by the calendar actions; never throws)
// ---------------------------------------------------------------------------
export async function pushEventChange(db: Db, userId: string, eventId: string) {
  try {
    const c = await connectionFor(db, userId);
    if (!c || c.status !== "active" || !c.workspace_id) return;
    const { data: e } = await db.from("calendar_events").select(LOCAL_COLS).eq("id", eventId).maybeSingle();
    if (!e || (e as LocalEvent).workspace_id !== c.workspace_id) return;
    const { data: link } = await db.from("calendar_sync_links").select("*").eq("connection_id", c.id).eq("event_id", eventId).maybeSingle();
    await pushOne(db, c, await accessToken(db, c), e as LocalEvent, (link as Link | null) ?? undefined, await timezoneOf(db, userId));
  } catch (err) {
    console.error("[google-calendar] push failed:", err instanceof Error ? err.message : err);
  }
}

// Before a Redial event is deleted: the Google events to remove afterwards.
export async function linksForEvent(db: Db, eventId: string) {
  const { data } = await db.from("calendar_sync_links").select("connection_id, google_event_id").eq("event_id", eventId);
  return (data ?? []) as Pick<Link, "connection_id" | "google_event_id">[];
}

export async function pushDeletes(db: Db, userId: string, links: Pick<Link, "connection_id" | "google_event_id">[]) {
  try {
    const c = await connectionFor(db, userId);
    const mine = links.filter((l) => l.connection_id === c?.id);
    if (!c || c.status !== "active" || !mine.length) return;
    const token = await accessToken(db, c);
    for (const l of mine) await call(token, `${calPath(c)}/${encodeURIComponent(l.google_event_id)}`, { method: "DELETE" });
  } catch (err) {
    console.error("[google-calendar] delete failed:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Full two-way sync
// ---------------------------------------------------------------------------
export type SyncResult = { pushed: number; pulled: number; removed: number; error?: string };

export async function syncGoogleCalendar(db: Db, userId: string): Promise<SyncResult> {
  const out: SyncResult = { pushed: 0, pulled: 0, removed: 0 };
  const c = await connectionFor(db, userId);
  if (!c) return { ...out, error: "Google isn't connected." };
  if (!c.workspace_id) return { ...out, error: "Pick which Redial calendar to sync." };
  try {
    const token = await accessToken(db, c);
    const tz = await timezoneOf(db, userId);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();

    // Links for this connection, both ways.
    const { data: linkRows } = await db.from("calendar_sync_links").select("*").eq("connection_id", c.id).limit(5000);
    const links = (linkRows ?? []) as Link[];
    const byEvent = new Map(links.map((l) => [l.event_id, l]));
    const byGoogle = new Map(links.map((l) => [l.google_event_id, l]));

    // 1. Pull Google's changes first (so a newer Google edit isn't overwritten).
    let pageToken: string | undefined;
    let nextSync: string | undefined;
    let syncToken = c.sync_token ?? undefined;
    const touched = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const q = new URLSearchParams({ singleEvents: "true", maxResults: "250", showDeleted: "true" });
      if (syncToken) q.set("syncToken", syncToken); else q.set("timeMin", since);
      if (pageToken) q.set("pageToken", pageToken);
      const res = await call(token, `${calPath(c)}?${q}`);
      if (res.status === 410 && syncToken) { syncToken = undefined; pageToken = undefined; page = -1; continue; } // token expired: start over
      if (!res.ok) throw new Error(`Google Calendar said ${res.status}.`);
      const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
      for (const g of body.items ?? []) {
        const link = byGoogle.get(g.id);
        if (g.status === "cancelled") {
          if (link) { await db.from("calendar_events").delete().eq("id", link.event_id); out.removed++; }
          continue;
        }
        const row = fromGoogle(g, tz);
        if (!row) continue;
        const gUpdated = g.updated ?? new Date().toISOString();
        if (link) {
          if (link.google_updated && ms(gUpdated) <= ms(link.google_updated)) continue; // nothing new
          const { data: local } = await db.from("calendar_events").select("updated_at").eq("id", link.event_id).maybeSingle();
          if (local && ms(local.updated_at) > ms(link.synced_at) && ms(local.updated_at) > ms(gUpdated)) continue; // Redial's edit is newer: pushed below
          await db.from("calendar_events").update(row).eq("id", link.event_id);
          await db.from("calendar_sync_links").update({ google_updated: gUpdated, synced_at: new Date().toISOString() }).eq("connection_id", c.id).eq("event_id", link.event_id);
          touched.add(link.event_id);
          out.pulled++;
        } else {
          // A Redial event we pushed earlier but lost the link to: relink, don't copy.
          const own = g.extendedProperties?.private?.redialEventId;
          const { data: made } = own && byEvent.has(own) ? { data: null } : await db.from("calendar_events").insert({ ...row, workspace_id: c.workspace_id, kind: "event" }).select("id").single();
          const eventId = made?.id ?? own;
          if (!eventId) continue;
          await db.from("calendar_sync_links").upsert({ connection_id: c.id, event_id: eventId, google_event_id: g.id, google_updated: gUpdated, synced_at: new Date().toISOString() });
          byEvent.set(eventId, { connection_id: c.id, event_id: eventId, google_event_id: g.id, google_updated: gUpdated, synced_at: new Date().toISOString() });
          touched.add(eventId);
          if (made) out.pulled++;
        }
      }
      pageToken = body.nextPageToken;
      nextSync = body.nextSyncToken ?? nextSync;
      if (!pageToken) break;
    }

    // 2. Push Redial events from the last 30 days on that Google hasn't seen or that changed since.
    const { data: locals } = await db.from("calendar_events").select(LOCAL_COLS).eq("workspace_id", c.workspace_id).gte("ends_at", since).limit(2000);
    for (const e of (locals ?? []) as LocalEvent[]) {
      if (touched.has(e.id)) continue;
      const link = byEvent.get(e.id);
      if (link && ms(e.updated_at) <= ms(link.synced_at)) continue;
      await pushOne(db, c, token, e, link, tz);
      out.pushed++;
    }

    // Our own pushes come back as changes next time; the google_updated
    // check skips them.
    await db.from("account_connections").update({
      sync_token: nextSync ?? c.sync_token, status: "active", last_error: null, last_synced_at: new Date().toISOString(),
    }).eq("id", c.id);
    return out;
  } catch (e) {
    const message = e instanceof GoogleAuthError && e.code === "invalid_grant" ? "Google access was removed or expired. Reconnect Google."
      : e instanceof Error ? e.message.slice(0, 300) : "Sync failed.";
    await db.from("account_connections").update({ last_error: message, last_synced_at: new Date().toISOString() }).eq("id", c.id);
    return { ...out, error: message };
  }
}
