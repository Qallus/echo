"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { encryptKey } from "@/lib/ai/keys";
import { e911OnNumber } from "@/lib/comms/e911";
import { createSipCredential, deleteSipCredential, newSipLogin, sipConfig, sipReady, updateSipPassword } from "@/lib/comms/sip";
import { requireUser } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { PHONE_MODELS } from "./phone-models";

// Phones on a line (owner only, RLS). Each phone gets a Twilio SIP login and
// an auto-setup address; both are shown once, when the phone is added or
// reset. The password is stored encrypted (for auto-setup) and the address's
// token only as a hash.

export type DeviceLogin = { deviceId: string; username: string; password: string; domain: string; setupUrl: string };
type Result = { ok?: string; error?: string; login?: DeviceLogin };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeMac = (raw: string) => raw.toLowerCase().replace(/[^0-9a-f]/g, "");
const newToken = () => randomBytes(24).toString("base64url");
const done = (r: Result): Result => { revalidatePath("/calls/phones"); return r; };

export async function addDevice(input: { lineId: string; modelId: string; label: string; mac: string }): Promise<Result> {
  await requireUser();
  const model = PHONE_MODELS.find((m) => m.id === input.modelId);
  if (!model) return { error: "Choose your phone's model." };
  const mac = normalizeMac(input.mac);
  if (model.vendor !== "other" && mac.length !== 12) return { error: "Enter the phone's MAC address: 12 letters and numbers from the label, like C0:74:AD:12:34:56." };
  const label = input.label.trim().slice(0, 60) || model.name;
  const sip = await sipConfig();
  if (!sipReady(sip)) return { error: "Desk phones aren't switched on for Redial yet. Ask Redial support to finish setting them up." };

  const supabase = await createClient();
  const { data: line } = await supabase.from("redial_lines").select("id, number").eq("id", input.lineId).maybeSingle();
  if (!line) return { error: "Line not found." };
  // 911 first: phones call out from this number, so Twilio must have its address.
  const e911 = await e911OnNumber(line.number);
  if (e911.status === "none" || e911.status === "failed") return { error: "Add this line's 911 address first (above), so emergency calls from the phone are sent with your location." };
  const { username, password } = newSipLogin();
  const cred = await createSipCredential(sip.listSid!, username, password);
  if (!cred.sid) return { error: `Couldn't create the phone's login: ${cred.error}` };
  const token = newToken();
  const { data: row, error } = await supabase.from("redial_devices").insert({
    line_id: input.lineId, label, model: model.id, vendor: model.vendor, mac: mac.length === 12 ? mac : null, sip_username: username,
    credential_sid: cred.sid, secret_enc: encryptKey(password), provision_token_hash: hash(token),
  }).select("id").single();
  if (error || !row) {
    await deleteSipCredential(sip.listSid!, cred.sid);
    return { error: error?.code === "23505" ? "That phone is already added (same MAC address)." : "Couldn't add the phone." };
  }
  return done({ ok: `${label} added.`, login: { deviceId: row.id, username, password, domain: sip.domain!, setupUrl: siteUrl(`/api/provision/${token}`) } });
}

// New password and a new auto-setup address (the old ones stop working).
export async function resetDevice(id: string): Promise<Result> {
  await requireUser();
  const sip = await sipConfig();
  if (!sipReady(sip)) return { error: "Desk phones aren't switched on for Redial yet." };
  const supabase = await createClient();
  const { data: d } = await supabase.from("redial_devices").select("id, label, sip_username, credential_sid").eq("id", id).maybeSingle();
  if (!d) return { error: "Phone not found." };
  const { password } = newSipLogin();
  if (d.credential_sid) {
    const r = await updateSipPassword(sip.listSid!, d.credential_sid, password);
    if (r.error) return { error: `Couldn't change the password: ${r.error}` };
  } else {
    const r = await createSipCredential(sip.listSid!, d.sip_username, password);
    if (!r.sid) return { error: `Couldn't create the phone's login: ${r.error}` };
    await supabase.from("redial_devices").update({ credential_sid: r.sid }).eq("id", id);
  }
  const token = newToken();
  const { error } = await supabase.from("redial_devices").update({ secret_enc: encryptKey(password), provision_token_hash: hash(token) }).eq("id", id);
  if (error) return { error: "Couldn't save the new password." };
  return done({ ok: `${d.label} has a new password and setup address.`, login: { deviceId: id, username: d.sip_username, password, domain: sip.domain!, setupUrl: siteUrl(`/api/provision/${token}`) } });
}

export async function setDeviceRing(id: string, ring: boolean): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("redial_devices").update({ ring }).eq("id", id);
  return error ? { error: "Couldn't change that phone." } : done({ ok: ring ? "This phone rings for calls." : "This phone won't ring for calls." });
}

// The phone's own settings page on the member's network ("192.168.4.119" or
// a full address). Empty clears it.
export async function setDeviceWebUrl(id: string, raw: string): Promise<Result> {
  await requireUser();
  const text = raw.trim();
  let url: string | null = null;
  if (text) {
    try {
      const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      if (!["http:", "https:"].includes(u.protocol) || !u.hostname || u.username || u.password) throw new Error();
      url = u.toString().replace(/\/$/, "");
    } catch { return { error: "Enter the phone's address, like 192.168.4.119." }; }
    if (url.length > 200) return { error: "That address is too long." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("redial_devices").update({ web_url: url }).eq("id", id).select("id");
  if (error || !data?.length) return { error: "Couldn't save that. If this keeps happening, the latest database update may not be applied yet." };
  return done({ ok: url ? "Saved. The link opens the phone's settings on the same network as the phone." : "Link removed." });
}

export async function removeDevice(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("redial_devices").delete().eq("id", id).select("id, credential_sid");
  if (error || !data?.length) return { error: "Couldn't remove that phone." };
  const sip = await sipConfig();
  if (data[0].credential_sid && sip.listSid) await deleteSipCredential(sip.listSid, data[0].credential_sid);
  return done({ ok: "Phone removed. Its login no longer works." });
}
