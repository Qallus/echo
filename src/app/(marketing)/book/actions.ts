"use server";

import { createClient } from "@/lib/supabase/server";

// The public booking page. The database functions check availability again
// and limit bookings per email address.

export type PublicType = { name: string; slug: string; description: string | null; minutes: number; location: string; timezone: string };

export async function openTimes(slug: string, date: string): Promise<string[]> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("booking_slots", { p_slug: slug, p_from: date, p_to: date });
  return ((data ?? []) as { starts_at: string }[]).map((r) => r.starts_at);
}

// Days in a month that have at least one open time (for the calendar).
export async function openDays(slug: string, from: string, to: string): Promise<string[]> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  const supabase = await createClient();
  const [{ data }, { data: type }] = await Promise.all([
    supabase.rpc("booking_slots", { p_slug: slug, p_from: from, p_to: to }),
    supabase.rpc("booking_type_public", { p_slug: slug }).maybeSingle<PublicType>(),
  ]);
  const tz = type?.timezone ?? "America/Phoenix";
  return [...new Set(((data ?? []) as { starts_at: string }[]).map((r) => new Date(r.starts_at).toLocaleDateString("en-CA", { timeZone: tz })))];
}

export async function book(input: { slug: string; startsAt: string; name: string; email: string; phone: string; company: string; notes: string; website?: string }): Promise<{ ok?: boolean; error?: string }> {
  if (input.website) return { ok: true }; // honeypot
  if (Number.isNaN(Date.parse(input.startsAt))) return { error: "Pick a time." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_appointment", {
    p_slug: input.slug, p_starts_at: input.startsAt, p_name: input.name.slice(0, 200), p_email: input.email.slice(0, 200),
    p_phone: input.phone.slice(0, 40), p_company: input.company.slice(0, 200), p_notes: input.notes.slice(0, 5000),
  });
  if (error) return { error: ["22023", "54000"].includes(error.code ?? "") ? error.message : "Couldn't book that. Please try again or contact us." };
  return { ok: true };
}

export async function registerForEvent(input: { slug: string; name: string; email: string; phone: string; company: string; guests: number; website?: string }): Promise<{ ok?: string; error?: string }> {
  if (input.website) return { ok: "registered" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("event_register", {
    p_slug: input.slug, p_name: input.name.slice(0, 200), p_email: input.email.slice(0, 200), p_phone: input.phone.slice(0, 40),
    p_company: input.company.slice(0, 200), p_guests: Math.max(1, Math.min(20, Math.round(input.guests) || 1)),
  });
  if (error) return { error: error.code === "22023" ? error.message : "Couldn't register. Please try again or contact us." };
  return { ok: data as string };
}
