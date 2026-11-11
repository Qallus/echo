import "server-only";
import { randomBytes } from "node:crypto";
import { siteUrl } from "@/lib/notify/senders";
import { secrets } from "@/lib/secrets";
import { twilioRequest } from "./twilio";

// Redial's Twilio SIP domain for desk, cordless and Wi-Fi phones. One domain
// for the whole platform (redial-<account>.sip.twilio.com) with one
// credential list: each phone gets its own username and password in it.
// Phones register to the domain (so Redial can ring them) and their outgoing
// calls come to /api/webhooks/twilio/redial/sip.

export type SipConfig = { domain: string | null; domainSid: string | null; listSid: string | null };

export async function sipConfig(): Promise<SipConfig> {
  const s = await secrets("TWILIO_SIP_DOMAIN", "TWILIO_SIP_DOMAIN_SID", "TWILIO_SIP_CREDENTIAL_LIST_SID");
  return { domain: s.TWILIO_SIP_DOMAIN ?? null, domainSid: s.TWILIO_SIP_DOMAIN_SID ?? null, listSid: s.TWILIO_SIP_CREDENTIAL_LIST_SID ?? null };
}
export const sipReady = (c: SipConfig) => Boolean(c.domain && c.domainSid && c.listSid);

const err = (r: { data: Record<string, unknown> }) => String(r.data.message ?? "Twilio refused the request.");

// Creates (or repairs) the domain, its credential list and both mappings.
// Returns the SIDs to store in Admin > Settings > Integrations.
export async function ensureSipDomain(current: SipConfig, accountSid: string): Promise<{ config?: Required<{ [K in keyof SipConfig]: string }>; error?: string }> {
  const voiceUrl = siteUrl("/api/webhooks/twilio/redial/sip");
  let domainSid = current.domainSid;
  let domain = current.domain;
  if (!domainSid) {
    const name = `redial-${accountSid.slice(-8).toLowerCase()}.sip.twilio.com`;
    const r = await twilioRequest("/SIP/Domains.json", {
      DomainName: name, FriendlyName: "Redial desk phones", VoiceUrl: voiceUrl, VoiceMethod: "POST", SipRegistration: "true",
    });
    if (!r.ok) return { error: `Couldn't create the SIP domain: ${err(r)}` };
    domainSid = String(r.data.sid);
    domain = String(r.data.domain_name);
  } else {
    const r = await twilioRequest(`/SIP/Domains/${domainSid}.json`, { VoiceUrl: voiceUrl, VoiceMethod: "POST", SipRegistration: "true" });
    if (!r.ok) return { error: `Couldn't update the SIP domain: ${err(r)}` };
    domain = String(r.data.domain_name);
  }
  let listSid = current.listSid;
  if (!listSid) {
    const r = await twilioRequest("/SIP/CredentialLists.json", { FriendlyName: "Redial phones" });
    if (!r.ok) return { error: `Couldn't create the credential list: ${err(r)}` };
    listSid = String(r.data.sid);
  }
  // Registrations (so phones can sign in) and calls (so they can dial out).
  for (const kind of ["Registrations", "Calls"]) {
    const r = await twilioRequest(`/SIP/Domains/${domainSid}/Auth/${kind}/CredentialListMappings.json`, { CredentialListSid: listSid });
    if (!r.ok && r.status !== 409 && !/already/i.test(err(r))) return { error: `Couldn't link the credential list (${kind.toLowerCase()}): ${err(r)}` };
  }
  return { config: { domain: domain!, domainSid: domainSid!, listSid } };
}

// A username and a strong password Twilio accepts (12+ characters with
// upper and lower case letters and a digit).
export function newSipLogin(): { username: string; password: string } {
  const username = `rd${randomBytes(6).toString("hex")}`;
  const raw = randomBytes(18).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return { username, password: `Rd${raw.slice(0, 20)}9x` };
}

export async function createSipCredential(listSid: string, username: string, password: string): Promise<{ sid?: string; error?: string }> {
  const r = await twilioRequest(`/SIP/CredentialLists/${listSid}/Credentials.json`, { Username: username, Password: password });
  return r.ok ? { sid: String(r.data.sid) } : { error: err(r) };
}

export async function updateSipPassword(listSid: string, credentialSid: string, password: string): Promise<{ error?: string }> {
  const r = await twilioRequest(`/SIP/CredentialLists/${listSid}/Credentials/${credentialSid}.json`, { Password: password });
  return r.ok ? {} : { error: err(r) };
}

export async function deleteSipCredential(listSid: string, credentialSid: string): Promise<void> {
  await twilioRequest(`/SIP/CredentialLists/${listSid}/Credentials/${credentialSid}.json`, {}, "DELETE");
}

// The address a line's phones ring at.
export const sipUri = (username: string, domain: string) => `sip:${username}@${domain}`;
