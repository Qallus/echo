import "server-only";
import { twilioRequest } from "./twilio";

// The 911 address on a Redial number. Twilio sends it to emergency services
// with every 911 call from the number (desk phones and the app call out with
// the line's number). Twilio is the source of truth: `e911OnNumber` reads it
// back (with the address itself), so nothing stored in Redial can stand in
// for a real registration.

export type E911Address = { customerName: string; street: string; street2?: string; city: string; region: string; postalCode: string };
export type E911State = { addressSid: string | null; status: "registered" | "pending" | "failed" | "none"; message?: string; address?: E911Address };

const msg = (r: { data: Record<string, unknown> }) => String(r.data.message ?? "Twilio refused the request.");

// "3605 W. Harrison Street" and "3605 W HARRISON ST" are the same place.
const WORDS: Record<string, string> = { street: "st", avenue: "ave", road: "rd", drive: "dr", boulevard: "blvd", lane: "ln", court: "ct", place: "pl", parkway: "pkwy", highway: "hwy", suite: "ste", west: "w", east: "e", north: "n", south: "s" };
const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((w) => WORDS[w] ?? w).join(" ");
const sameAddress = (a: E911Address, b: E911Address) =>
  norm(a.street) === norm(b.street) && norm(a.street2) === norm(b.street2) && norm(a.city) === norm(b.city) && a.postalCode.slice(0, 5) === b.postalCode.slice(0, 5);

type Raw = Record<string, unknown>;
const fromTwilio = (d: Raw): E911Address => ({
  customerName: String(d.customer_name ?? ""), street: String(d.street ?? ""), street2: (d.street_secondary as string | null) || undefined,
  city: String(d.city ?? ""), region: String(d.region ?? ""), postalCode: String(d.postal_code ?? ""),
});

async function numberSid(number: string): Promise<{ sid?: string; error?: string }> {
  const r = await twilioRequest("/IncomingPhoneNumbers.json", { PhoneNumber: number, PageSize: "1" }, "GET");
  if (!r.ok) return { error: msg(r) };
  const list = (r.data.incoming_phone_numbers ?? []) as { sid: string }[];
  return list[0]?.sid ? { sid: list[0].sid } : { error: "That number isn't on Redial's Twilio account." };
}

function stateOf(n: Raw): E911State {
  const sid = (n.emergency_address_sid as string | null) ?? null;
  const s = String(n.emergency_address_status ?? "");
  if (!sid) return { addressSid: null, status: "none" };
  if (s === "registered") return { addressSid: sid, status: "registered" };
  if (/fail/.test(s)) return { addressSid: sid, status: "failed", message: "Twilio couldn't register this address for 911. Check it and save again." };
  return { addressSid: sid, status: "pending" };
}

async function readNumber(number: string): Promise<{ sid?: string; data?: Raw; error?: string }> {
  const pn = await numberSid(number);
  if (!pn.sid) return { error: pn.error };
  const r = await twilioRequest(`/IncomingPhoneNumbers/${pn.sid}.json`, {}, "GET");
  return r.ok ? { sid: pn.sid, data: r.data } : { error: msg(r) };
}

// What's on the number now, including the address itself (Twilio is the
// record even when the address was set outside Redial).
export async function e911OnNumber(number: string): Promise<E911State & { error?: string }> {
  const n = await readNumber(number);
  if (!n.data) return { addressSid: null, status: "none", error: n.error };
  const state = stateOf(n.data);
  if (!state.addressSid) return state;
  const a = await twilioRequest(`/Addresses/${state.addressSid}.json`, {}, "GET");
  return a.ok ? { ...state, address: fromTwilio(a.data) } : state;
}

// An emergency address on the account for this place: one Redial already
// made for the number (so retries don't pile up copies), or a new one.
async function addressFor(number: string, a: E911Address): Promise<{ sid?: string; error?: string }> {
  const list = await twilioRequest("/Addresses.json", { FriendlyName: `Redial 911 · ${number}`, PageSize: "50" }, "GET");
  const found = list.ok ? ((list.data.addresses ?? []) as Raw[]).find((x) => x.emergency_enabled && sameAddress(fromTwilio(x), a)) : undefined;
  if (found) return { sid: String(found.sid) };
  const ad = await twilioRequest("/Addresses.json", {
    CustomerName: a.customerName, Street: a.street, ...(a.street2 ? { StreetSecondary: a.street2 } : {}), City: a.city,
    Region: a.region, PostalCode: a.postalCode, IsoCountry: "US", EmergencyEnabled: "true", AutoCorrectAddress: "true",
    FriendlyName: `Redial 911 · ${number}`,
  });
  if (ad.ok) return { sid: String(ad.data.sid) };
  const code = Number(ad.data.code ?? 0);
  return { error: code === 21615 || code === 21628 ? "That address couldn't be found. Check the street, city and ZIP code." : `Couldn't save the address: ${msg(ad)}` };
}

// Puts this address on the number. If the number already has the same
// address, nothing changes. Otherwise the old one comes off first (Twilio
// won't swap them), then the new one goes on and emergency calling is
// switched on. Twilio takes one of these changes per request.
export async function registerE911(number: string, a: E911Address): Promise<E911State & { error?: string }> {
  const now = await e911OnNumber(number);
  if (now.error) return { addressSid: null, status: "failed", error: now.error };
  if (now.addressSid && now.address && sameAddress(now.address, a) && now.status !== "failed") return now;

  const ad = await addressFor(number, a);
  if (!ad.sid) return { ...now, status: now.status === "none" ? "failed" : now.status, error: ad.error };

  const n = await readNumber(number);
  if (!n.sid || !n.data) return { addressSid: null, status: "failed", error: n.error };
  const path = `/IncomingPhoneNumbers/${n.sid}.json`;
  if (n.data.emergency_address_sid && n.data.emergency_address_sid !== ad.sid) {
    if (n.data.emergency_status === "Active") await twilioRequest(path, { EmergencyStatus: "Inactive" });
    const off = await twilioRequest(path, { EmergencyAddressSid: "" });
    if (!off.ok) return { ...stateOf(n.data), error: `Your current 911 address is still on the number; the new one couldn't replace it: ${msg(off)}` };
  }
  let r = await twilioRequest(path, { EmergencyAddressSid: ad.sid });
  if (!r.ok) return { addressSid: ad.sid, status: "failed", error: `The address was saved but couldn't be put on the number: ${msg(r)}` };
  if (r.data.emergency_status !== "Active") {
    r = await twilioRequest(path, { EmergencyStatus: "Active" });
    if (!r.ok) return { addressSid: ad.sid, status: "failed", error: `The address is on the number, but 911 couldn't be switched on: ${msg(r)}` };
  }
  return { ...stateOf(r.data), address: a };
}
