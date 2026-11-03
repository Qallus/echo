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
