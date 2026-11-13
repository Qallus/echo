"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptKey } from "@/lib/ai/keys";
import { registerE911 } from "@/lib/comms/e911";
import { requireUser } from "@/lib/data";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// The member's side of P3: the 911 address on a line (registered with
// Twilio), and requests to bring an existing number to Redial.

type Result = { ok?: string; error?: string };

const ZIP = /^[0-9]{5}(-[0-9]{4})?$/;
const STATE = /^[A-Za-z]{2}$/;
const text = (max: number) => z.string().trim().min(1).max(max);

const addressSchema = z.object({
  customerName: text(120), street: text(200), street2: z.string().trim().max(100).optional(),
  city: text(100), region: z.string().trim().regex(STATE), postalCode: z.string().trim().regex(ZIP),
});
export type E911Form = z.infer<typeof addressSchema>;

export async function saveE911(lineId: string, form: E911Form): Promise<Result> {
  await requireUser();
  const p = addressSchema.safeParse(form);
  if (!p.success) return { error: "Fill in the name, street, city, 2-letter state and ZIP code." };
  const a = { ...p.data, region: p.data.region.toUpperCase(), street2: p.data.street2 || undefined };
  const supabase = await createClient();
  const { data: line } = await supabase.from("redial_lines").select("id, number, owner_id").eq("id", lineId).maybeSingle();
  const { data: { user } } = await supabase.auth.getUser();
  if (!line || line.owner_id !== user?.id) return { error: "Only the line's owner can set its 911 address." };

  const r = await registerE911(line.number, a);
  // The number kept its current address: leave Redial's copy showing that.
  if (r.error && r.status !== "failed") { revalidatePath("/calls/phones"); return { error: r.error }; }
  const row = {
    customer_name: a.customerName, street: a.street, street2: a.street2 ?? null, city: a.city, region: a.region, postal_code: a.postalCode,
    address_sid: r.addressSid, status: r.status === "none" ? "failed" : r.status, message: r.error ?? r.message ?? null,
  };
  const { error } = await supabase.from("redial_e911").upsert({ line_id: lineId, ...row }, { onConflict: "line_id" });
  revalidatePath("/calls/phones");
  if (r.error) return { error: r.error };
  if (error) return { error: "The address is registered, but Redial couldn't save a copy. Refresh the page." };
  return { ok: r.status === "registered" ? "911 address registered." : "Address saved. Twilio is finishing the 911 registration; it usually takes a few minutes." };
}

// ---------------------------------------------------------------------------
// Porting
// ---------------------------------------------------------------------------
const portSchema = z.object({
  lineId: z.string().uuid().nullable(),
  number: z.string(), numberType: z.enum(["mobile", "landline", "voip"]),
  carrier: text(100), accountName: text(120), accountNumber: z.string().trim().min(1).max(40), pin: z.string().trim().max(20).optional(),
  street: text(200), city: text(100), region: z.string().trim().regex(STATE), postalCode: z.string().trim().regex(ZIP),
  authorizedName: text(120), authorize: z.literal(true), wantedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  note: z.string().max(1000).optional(),
});
export type PortForm = z.input<typeof portSchema>;

export async function requestPort(form: PortForm): Promise<Result> {
  await requireUser();
  const p = portSchema.safeParse(form);
  if (!p.success) {
    const field = p.error.issues[0]?.path[0];
    return { error: field === "authorize" ? "Check the box to authorize the transfer." : "Fill in every required field (the account number and the billing address must match your current carrier's bill)." };
  }
  const f = p.data;
  const number = toE164(f.number);
  if (!number || !/^\+1[2-9]\d{9}$/.test(number)) return { error: "Enter the US number you want to bring, with its area code." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("redial_port_submit", {
    p_line: f.lineId, p_number: number, p_number_type: f.numberType, p_carrier: f.carrier, p_account_name: f.accountName,
    p_account_number_enc: encryptKey(f.accountNumber), p_pin_enc: f.pin ? encryptKey(f.pin) : null, p_account_hint: f.accountNumber.slice(-4),
    p_street: f.street, p_city: f.city, p_region: f.region.toUpperCase(), p_postal: f.postalCode,
    p_authorized_name: f.authorizedName, p_wanted_date: f.wantedDate || null, p_note: f.note ?? null,
  });
  if (error) return { error: error.code === "23505" ? "There's already an open request for that number." : error.message.includes("Too many") ? "That's a lot of requests today. Contact Redial support." : "Couldn't send the request." };
  revalidatePath("/calls/port");
  return { ok: "Request sent. Redial support will review it and confirm the transfer date with you." };
}

export async function cancelPort(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("redial_port_cancel", { p_id: id });
  revalidatePath("/calls/port");
  return error ? { error: error.message } : { ok: "Request cancelled." };
}
