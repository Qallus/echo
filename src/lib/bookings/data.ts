import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, Registration } from "./events";
import { parseAvailability, type Availability, type Booking, type BookingType } from "./types";

// Booking reads for the admin (RLS: crm.view).

export async function listBookingTypes(): Promise<BookingType[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("booking_types").select("*").order("sort").order("name");
  return (data ?? []) as BookingType[];
}

export async function listBookings(opts: { contactId?: string; dealId?: string; companyId?: string } = {}): Promise<Booking[]> {
  const supabase = await createClient();
  let q = supabase.from("bookings").select("*").order("starts_at", { ascending: false }).limit(1000);
  if (opts.contactId) q = q.eq("contact_id", opts.contactId);
  if (opts.dealId) q = q.eq("deal_id", opts.dealId);
  if (opts.companyId) q = q.eq("company_id", opts.companyId);
  const { data } = await q;
  return (data ?? []) as Booking[];
}

export async function getAvailability(): Promise<Availability> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "booking_availability").maybeSingle();
  return parseAvailability(data?.value);
}

export async function listEvents(): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false }).limit(500);
  return (data ?? []) as EventRow[];
}

export async function listRegistrations(): Promise<Registration[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("event_registrations").select("*").order("created_at", { ascending: false }).limit(5000);
  return (data ?? []) as Registration[];
}
