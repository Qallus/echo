import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { e164, twilioSms } from "@/lib/comms/twilio";
import { emailHtml, sendEmail, siteUrl } from "@/lib/notify/senders";
import { formatWhen, parseAvailability } from "./types";

// Reminders for bookings starting in the next 24 hours (service role, from the
// cron job): an email, and a text when there's a phone number. Once each.
export async function sendBookingReminders(db: SupabaseClient) {
  const now = new Date();
  const { data: rows } = await db.from("bookings").select("id, title, starts_at, name, email, phone, location, status")
    .is("reminder_sent_at", null).in("status", ["pending", "confirmed"])
    .gt("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 24 * 3600_000).toISOString()).limit(100);
  if (!rows?.length) return 0;
  const { data: cfg } = await db.from("platform_settings").select("value").eq("key", "booking_availability").maybeSingle();
  const tz = parseAvailability(cfg?.value).timezone;
  let sent = 0;
  for (const b of rows) {
    const when = formatWhen(b.starts_at, tz);
    const first = b.name.split(" ")[0];
    if (b.email) {
      const body = `Hi ${first}, this is a reminder of your ${b.title.replace(/ with .*$/, "")} on ${when} (${tz.replace("_", " ")} time).${b.location ? ` Where: ${b.location}.` : ""} Reply to this email if you need to reschedule.`;
      const res = await sendEmail(b.email, `Reminder: ${when}`, emailHtml({ title: "Your appointment is coming up", body, url: siteUrl("/contact"), cta: "Contact us" }), body);
      if (res.ok) sent++;
    }
    const to = e164(b.phone);
    if (to) await twilioSms(to, `Reminder: ${b.title.replace(/ with .*$/, "")} on ${when}. Reply to reschedule.`);
    await db.from("bookings").update({ reminder_sent_at: now.toISOString() }).eq("id", b.id);
  }
  return sent;
}

// Reminders for event registrations, the day before the event (service role).
export async function sendEventReminders(db: SupabaseClient) {
  const now = new Date();
  const { data: events } = await db.from("events").select("id, title, starts_at, ends_at, all_day, location, location_kind, online_url")
    .eq("status", "published").gt("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 24 * 3600_000).toISOString());
  if (!events?.length) return 0;
  const { data: cfg } = await db.from("platform_settings").select("value").eq("key", "booking_availability").maybeSingle();
  const tz = parseAvailability(cfg?.value).timezone;
  let sent = 0;
  for (const e of events) {
    const { data: regs } = await db.from("event_registrations").select("id, name, email").eq("event_id", e.id).eq("status", "registered").is("reminder_sent_at", null).limit(500);
    const when = e.all_day ? new Date(e.starts_at).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }) : formatWhen(e.starts_at, tz);
    for (const r of regs ?? []) {
      const where = [e.location_kind !== "online" ? e.location : null, e.location_kind !== "in_person" && e.online_url ? `Join online: ${e.online_url}` : null].filter(Boolean).join(". ");
      const body = `Hi ${r.name.split(" ")[0]}, a reminder that ${e.title} is ${when}${e.all_day ? "" : ` (${tz.replace("_", " ")} time)`}.${where ? ` ${where}.` : ""} See you there!`;
      const res = await sendEmail(r.email, `Reminder: ${e.title}`, emailHtml({ title: e.title, body, url: siteUrl("/book"), cta: "Event details" }), body);
      if (res.ok) sent++;
      await db.from("event_registrations").update({ reminder_sent_at: now.toISOString() }).eq("id", r.id);
    }
  }
  return sent;
}
