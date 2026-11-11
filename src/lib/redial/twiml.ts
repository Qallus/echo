import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sipConfig, sipUri } from "@/lib/comms/sip";
import { xml } from "@/lib/comms/twilio";
import { siteUrl } from "@/lib/notify/senders";
import type { Line } from "./types";

// TwiML pieces for Redial calls. Callers hear Twilio's built-in voice only on
// fallbacks; the screening conversation itself is the AI voice.

export const redialUrl = (path: string, call: string, extra = "") => siteUrl(`/api/webhooks/twilio/redial/${path}?call=${call}${extra}`);
const hook = (path: string, call: string, extra = "") => xml(redialUrl(path, call, extra));

// Ring the member's phone, and any desk phones on the line (SIP URIs), with
// our number as caller ID, so they know it's a Redial call; a whisper asks
// them to press 1 before the caller is joined.
export function ringOwner(line: Line, callId: string, announce: boolean, sip: string[] = []) {
  const legs = [
    ...(line.forward_to ? [`<Number url="${hook("whisper", callId)}">${xml(line.forward_to)}</Number>`] : []),
    ...sip.map((uri) => `<Sip url="${hook("whisper", callId)}">${xml(uri)}</Sip>`),
  ].join("");
  return `${announce ? `<Say>One moment while I connect you.</Say>` : ""}<Dial timeout="20" callerId="${xml(line.number)}" action="${hook("dial", callId)}">${legs}</Dial>`;
}

// Desk phones on a line that ring for calls, as SIP URIs.
export async function lineSipUris(db: SupabaseClient, lineId: string): Promise<string[]> {
  const sip = await sipConfig();
  if (!sip.domain) return [];
  const { data } = await db.from("redial_devices").select("sip_username").eq("line_id", lineId).eq("ring", true).limit(10);
  return (data ?? []).map((d) => sipUri(d.sip_username, sip.domain!));
}

export function voicemail(callId: string, prompt: string) {
  return `<Say>${xml(prompt)}</Say><Record maxLength="120" playBeep="true" trim="trim-silence" action="${hook("dial", callId, "&done=1")}" recordingStatusCallback="${hook("recording", callId)}" recordingStatusCallbackEvent="completed"/><Say>Thanks. Goodbye.</Say><Hangup/>`;
}

// Direct path: the caller's own call streams to the gateway.
export function stream(gatewayUrl: string, token: string, callId: string) {
  return `<Connect><Stream url="${xml(`${gatewayUrl}/twilio`)}"><Parameter name="token" value="${xml(token)}"/></Stream></Connect><Redirect method="POST">${hook("after", callId)}</Redirect>`;
}

// Conference path: the caller waits in a conference (silently; the AI joins
// within a second or two) and the call ends when they leave. The AI is its
// own participant (agentStream), so it can leave without dropping the caller.
export const conferenceName = (callId: string) => `redial-${callId}`;
export function conference(callId: string) {
  return `<Dial action="${hook("after", callId)}"><Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="" participantLabel="caller" statusCallback="${hook("conference", callId)}" statusCallbackEvent="start end join leave mute">${conferenceName(callId)}</Conference></Dial>`;
}

// The AI participant's leg (TwiML App call): stream to the gateway, then
// leave the conference when the conversation ends.
export function agentStream(gatewayUrl: string, token: string) {
  return `<Connect><Stream url="${xml(`${gatewayUrl}/twilio`)}"><Parameter name="token" value="${xml(token)}"/></Stream></Connect><Hangup/>`;
}

// Insider: a member's browser joins as a listener. muted="true" is enforced
// by Twilio, so nothing they say reaches the call, and they never start or
// end the conference.
export const listenLabel = (userId: string) => `listen-${userId}`;
export function listenerJoin(name: string, userId: string) {
  return `<Dial><Conference muted="true" beep="false" startConferenceOnEnter="false" endConferenceOnExit="false" participantLabel="${xml(listenLabel(userId))}">${xml(name)}</Conference></Dial>`;
}

// Directory: the person a call is being transferred to hears who's calling
// and why, privately, and presses 1 to be joined to the conference.
export const transferLabel = (transferId: string) => `transfer-${transferId}`;
export function transferBriefing(callId: string, transferId: string, briefing: string) {
  const accept = hook("transfer", callId, `&t=${transferId}&step=accept`);
  return `<Gather numDigits="1" timeout="8" action="${accept}"><Say>${xml(briefing)} Press 1 to take the call.</Say></Gather><Say>No problem. Goodbye.</Say><Hangup/>`;
}
export function transferJoin(name: string, transferId: string) {
  return `<Dial><Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" participantLabel="${xml(transferLabel(transferId))}">${xml(name)}</Conference></Dial>`;
}
