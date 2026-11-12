import "server-only";
import { twilioRequest } from "./twilio";

// The 911 address on a Redial number. Twilio sends it to emergency services
// with every 911 call from the number (desk phones and the app call out with
// the line's number). Twilio is the source of truth: `e911OnNumber` reads it
// back, so nothing stored in Redial can stand in for a real registration.

export type E911Address = { customerName: string; street: string; street2?: string; city: string; region: string; postalCode: string };
export type E911State = { addressSid: string | null; status: "registered" | "pending" | "failed" | "none"; message?: string };

const msg = (r: { data: Record<string, unknown> }) => String(r.data.message ?? "Twilio refused the request.");

async function numberSid(number: string): Promise<{ sid?: string; error?: string }> {
  const r = await twilioRequest("/IncomingPhoneNumbers.json", { PhoneNumber: number, PageSize: "1" }, "GET");
  if (!r.ok) return { error: msg(r) };
  const list = (r.data.incoming_phone_numbers ?? []) as { sid: string }[];
  return list[0]?.sid ? { sid: list[0].sid } : { error: "That number isn't on Redial's Twilio account." };
}

function stateOf(n: Record<string, unknown>): E911State {
  const sid = (n.emergency_address_sid as string | null) ?? null;
  const s = String(n.emergency_address_status ?? "");
  if (!sid) return { addressSid: null, status: "none" };
  if (s === "registered") return { addressSid: sid, status: "registered" };
  if (/fail/.test(s)) return { addressSid: sid, status: "failed", message: "Twilio couldn't register this address for 911. Check it and save again." };
  return { addressSid: sid, status: "pending" };
}

export async function e911OnNumber(number: string): Promise<E911State & { error?: string }> {
  const pn = await numberSid(number);
  if (!pn.sid) return { addressSid: null, status: "none", error: pn.error };
  const r = await twilioRequest(`/IncomingPhoneNumbers/${pn.sid}.json`, {}, "GET");
  return r.ok ? stateOf(r.data) : { addressSid: null, status: "none", error: msg(r) };
}

// Validates the address, creates it as an emergency address and puts it on
// the number. The old address (if any) is replaced on the number.
export async function registerE911(number: string, a: E911Address): Promise<E911State & { error?: string }> {
  const pn = await numberSid(number);
  if (!pn.sid) return { addressSid: null, status: "failed", error: pn.error };
  const ad = await twilioRequest("/Addresses.json", {
    CustomerName: a.customerName, Street: a.street, ...(a.street2 ? { StreetSecondary: a.street2 } : {}), City: a.city,
    Region: a.region, PostalCode: a.postalCode, IsoCountry: "US", EmergencyEnabled: "true", AutoCorrectAddress: "true",
    FriendlyName: `Redial 911 · ${number}`,
  });
  if (!ad.ok) {
    const code = Number(ad.data.code ?? 0);
    return { addressSid: null, status: "failed", error: code === 21615 || code === 21628 ? "That address couldn't be found. Check the street, city and ZIP code." : `Couldn't save the address: ${msg(ad)}` };
  }
  // Twilio won't swap one emergency address for another: take the old one
  // off the number first (911 keeps working from the mobile meanwhile).
  const cur = await twilioRequest(`/IncomingPhoneNumbers/${pn.sid}.json`, {}, "GET");
  if (cur.ok && cur.data.emergency_address_sid && cur.data.emergency_address_sid !== ad.data.sid) {
    if (cur.data.emergency_status === "Active") await twilioRequest(`/IncomingPhoneNumbers/${pn.sid}.json`, { EmergencyStatus: "Inactive" });
    const off = await twilioRequest(`/IncomingPhoneNumbers/${pn.sid}.json`, { EmergencyAddressSid: "" });
    if (!off.ok) return { addressSid: String(ad.data.sid), status: "failed", error: `The address was saved but the old one couldn't be taken off the number: ${msg(off)}` };
  }
  const r = await twilioRequest(`/IncomingPhoneNumbers/${pn.sid}.json`, { EmergencyAddressSid: String(ad.data.sid), EmergencyStatus: "Active" });
  if (!r.ok) return { addressSid: String(ad.data.sid), status: "failed", error: `The address was saved but couldn't be put on the number: ${msg(r)}` };
  return stateOf(r.data);
}
