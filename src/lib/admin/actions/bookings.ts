"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { zonedToUtc } from "@/lib/bookings/time";
import { isBookingStatus, parseAvailability, slugify, type Availability, type BookingStatus } from "@/lib/bookings/types";
import { email, ref, refresh, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Bookings in the admin (crm.manage, audited).

const done = <T extends Result>(r: T): T => { revalidatePath("/admin/bookings"); refresh(); return r; };
const int = (v: unknown, min: number, max: number, d: number) => Math.max(min, Math.min(max, Math.round(Number(v ?? d)) || d));

export async function saveBookingType(id: string | null, input: {
  name: string; slug?: string; description?: string; minutes: number; location: string; location_detail?: string; buffer_minutes?: number;
  min_notice_hours?: number; max_days_ahead?: number; host_id?: string | null; color?: string; active: boolean; sort?: number;
}): Promise<Result> {
  await requireStaff("crm.manage");
  const name = text(input.name, 120);
  if (!name) return { error: "Name the appointment type." };
  const slug = slugify(input.slug || name);
  if (!slug) return { error: "Give it a link name (letters and numbers)." };
  const row = {
    name, slug, description: text(input.description, 1000), minutes: int(input.minutes, 5, 480, 30),
    location: ["phone", "video", "in_person"].includes(input.location) ? input.location : "video", location_detail: text(input.location_detail, 300),
    buffer_minutes: int(input.buffer_minutes, 0, 240, 0), min_notice_hours: int(input.min_notice_hours, 0, 720, 4), max_days_ahead: int(input.max_days_ahead, 1, 365, 30),
    host_id: ref(input.host_id), color: text(input.color, 20) ?? "sky", active: Boolean(input.active), sort: int(input.sort, -1000, 1000, 0),
  };
  const supabase = await createClient();
  const { data, error } = id && isUuid(id)
    ? await supabase.from("booking_types").update(row).eq("id", id).select("id").single()
    : await supabase.from("booking_types").insert(row).select("id").single();
  if (error) return { error: error.code === "23505" ? "That link name is taken. Pick another." : error.message };
  await adminAudit(supabase, id ? "bookings.type.update" : "bookings.type.create", { type: "booking_type", id: data.id }, { name, slug, active: row.active });
  return done({ ok: "Saved.", id: data.id });
}

export async function deleteBookingType(id: string): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("booking_types").delete().eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "bookings.type.delete", { type: "booking_type", id });
  return done({ ok: "Deleted. Existing bookings are kept." });
}

export async function saveAvailability(value: Availability): Promise<Result> {
  await requireStaff("crm.manage");
  const clean = parseAvailability(value);
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "booking_availability", value: clean });
  if (error) return { error: error.message };
  await adminAudit(supabase, "bookings.availability", { type: "setting", id: "booking_availability" }, { timezone: clean.timezone, days: Object.keys(clean.days) });
  return done({ ok: "Availability saved." });
}

// A booking made by staff. Links the contact by email (or the one given),
// and puts the meeting on their timeline when it's new.
export async function saveBooking(id: string | null, input: {
  type_id?: string | null; title?: string; date: string; time: string; minutes: number; timezone: string; status?: string; name: string;
  email?: string; phone?: string; company?: string; notes?: string; location?: string; host_id?: string | null;
  contact_id?: string | null; company_id?: string | null; deal_id?: string | null;
}): Promise<Result> {
  await requireStaff("crm.manage");
  const name = text(input.name, 200);
  if (!name) return { error: "Who is the booking with?" };
  const mail = email(input.email);
  if (mail === false) return { error: "That email address doesn't look right." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) return { error: "Pick a date and time." };
  const start = zonedToUtc(input.date, input.time, input.timezone);
  if (!start) return { error: "That date or time isn't valid." };
  const minutes = int(input.minutes, 5, 720, 30);
  const supabase = await createClient();

  let contactId = ref(input.contact_id);
  if (!contactId && mail) contactId = (await supabase.from("crm_contacts").select("id").eq("email", mail).limit(1).maybeSingle()).data?.id ?? null;
  const typeId = ref(input.type_id);
  const typeName = typeId ? (await supabase.from("booking_types").select("name").eq("id", typeId).maybeSingle()).data?.name : null;
  const row = {
    type_id: typeId, title: text(input.title, 200) ?? `${typeName ?? "Meeting"} with ${name}`, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(), status: isBookingStatus(input.status) ? input.status : "confirmed",
    name, email: mail, phone: text(input.phone, 40), company: text(input.company, 200), notes: text(input.notes, 5000), location: text(input.location, 300),
    host_id: ref(input.host_id), contact_id: contactId, company_id: ref(input.company_id), deal_id: ref(input.deal_id),
  };
  const { data, error } = id && isUuid(id)
    ? await supabase.from("bookings").update(row).eq("id", id).select("id").single()
    : await supabase.from("bookings").insert(row).select("id").single();
  if (error) return { error: error.message };
  if (!id && (row.contact_id || row.deal_id || row.company_id)) {
    await supabase.from("crm_activities").insert({
      kind: "meeting", subject: row.title, body: row.notes ?? "", contact_id: row.contact_id, deal_id: row.deal_id, company_id: row.company_id, due_at: row.starts_at,
    });
  }
  await adminAudit(supabase, id ? "bookings.update" : "bookings.create", { type: "booking", id: data.id }, { title: row.title, starts_at: row.starts_at });
  return done({ ok: id ? "Booking updated." : "Booked.", id: data.id });
}

export async function setBookingStatus(ids: string[], status: BookingStatus): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = uuids(ids);
  if (!targets.length || !isBookingStatus(status)) return { error: "Nothing to update." };
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ status }).in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "bookings.status", { type: "booking", id: targets[0] }, { count: targets.length, status });
  return done({ ok: "Updated." });
}

export async function deleteBookings(ids: string[]): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = uuids(ids);
  if (!targets.length) return { error: "Nothing to delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").delete().in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "bookings.delete", { type: "booking", id: targets[0] }, { count: targets.length });
  return done({ ok: "Deleted." });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export async function saveEvent(id: string | null, input: {
  title: string; slug?: string; summary?: string; description?: string; location_kind: string; location?: string; online_url?: string;
  start_date: string; end_date?: string; start_time?: string; end_time?: string; all_day: boolean; capacity?: number | string | null;
  status: string; registration_open: boolean; host_id?: string | null; timezone: string;
}): Promise<Result> {
  await requireStaff("crm.manage");
  const title = text(input.title, 200);
  if (!title) return { error: "Name the event." };
  const slug = slugify(input.slug || title).slice(0, 80);
  const endDate = input.end_date || input.start_date;
  const start = zonedToUtc(input.start_date, input.all_day ? "00:00" : input.start_time ?? "", input.timezone);
  let end = zonedToUtc(endDate, input.all_day ? "00:00" : input.end_time ?? "", input.timezone);
  if (!start || !end) return { error: "Pick the dates and times." };
  if (input.all_day) end = new Date(end.getTime() + 86400_000);
  if (end <= start) return { error: "The event has to end after it starts." };
  const cap = input.capacity === "" || input.capacity == null ? null : Math.round(Number(input.capacity));
  const url = text(input.online_url, 500);
  const row = {
    title, slug, summary: text(input.summary, 500), description: text(input.description, 20000),
    location_kind: ["in_person", "online", "hybrid"].includes(input.location_kind) ? input.location_kind : "in_person", location: text(input.location, 300),
    online_url: url && /^https?:\/\//i.test(url) ? url : null, starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: Boolean(input.all_day),
    capacity: cap && cap > 0 ? Math.min(cap, 100000) : null, status: ["draft", "published", "canceled"].includes(input.status) ? input.status : "draft",
    registration_open: Boolean(input.registration_open), host_id: ref(input.host_id),
  };
  const supabase = await createClient();
  const { data, error } = id && isUuid(id)
    ? await supabase.from("events").update(row).eq("id", id).select("id").single()
    : await supabase.from("events").insert(row).select("id").single();
  if (error) return { error: error.code === "23505" ? "That link name is taken. Pick another." : error.message };
  await adminAudit(supabase, id ? "events.update" : "events.create", { type: "event", id: data.id }, { title, status: row.status });
  return done({ ok: "Event saved.", id: data.id });
}

export async function deleteEvent(id: string): Promise<Result> {
  await requireStaff("crm.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", id).select("title").maybeSingle();
  if (error) return { error: error.message };
  await adminAudit(supabase, "events.delete", { type: "event", id }, { title: data?.title });
  return done({ ok: "Event deleted." });
}

export async function setRegistrationStatus(ids: string[], status: "registered" | "canceled" | "attended" | "no_show"): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = uuids(ids);
  if (!targets.length || !["registered", "canceled", "attended", "no_show"].includes(status)) return { error: "Nothing to update." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").update({ status }).in("id", targets);
  if (error) return { error: error.message };
  await adminAudit(supabase, "events.registrations.status", { type: "event_registration", id: targets[0] }, { count: targets.length, status });
  return done({ ok: "Updated." });
}

// Staff add someone to an event (phone or walk-in).
export async function addRegistration(eventId: string, input: { name: string; email: string; phone?: string; company?: string; guests?: number }): Promise<Result> {
  await requireStaff("crm.manage");
  const name = text(input.name, 200);
  const mail = email(input.email);
  if (!isUuid(eventId) || !name || !mail) return { error: "Enter a name and a valid email." };
  const supabase = await createClient();
  const contactId = (await supabase.from("crm_contacts").select("id").eq("email", mail).limit(1).maybeSingle()).data?.id ?? null;
  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId, name, email: mail, phone: text(input.phone, 40), company: text(input.company, 200), guests: int(input.guests, 1, 20, 1), contact_id: contactId,
  });
  if (error) return { error: error.code === "23505" ? "They're already registered." : error.message };
  await adminAudit(supabase, "events.registrations.add", { type: "event", id: eventId });
  return done({ ok: `${name} added.` });
}
