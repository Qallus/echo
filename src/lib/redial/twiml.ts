import "server-only";
import { xml } from "@/lib/comms/twilio";
import { siteUrl } from "@/lib/notify/senders";
import type { Line } from "./types";

// TwiML pieces for Redial calls. Callers hear Twilio's built-in voice only on
// fallbacks; the screening conversation itself is the AI voice.

export const redialUrl = (path: string, call: string, extra = "") => siteUrl(`/api/webhooks/twilio/redial/${path}?call=${call}${extra}`);
const hook = (path: string, call: string, extra = "") => xml(redialUrl(path, call, extra));

// Ring the member's phone with our number as caller ID, so they know it's a
// Redial call; a whisper asks them to press 1 before the caller is joined.
export function ringOwner(line: Line, callId: string, announce: boolean) {
  return `${announce ? `<Say>One moment while I connect you.</Say>` : ""}<Dial timeout="20" callerId="${xml(line.number)}" action="${hook("dial", callId)}"><Number url="${hook("whisper", callId)}">${xml(line.forward_to!)}</Number></Dial>`;
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
