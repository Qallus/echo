import "server-only";
import { xml } from "@/lib/comms/twilio";
import { siteUrl } from "@/lib/notify/senders";
import type { Line } from "./types";

// TwiML pieces for Redial calls. Callers hear Twilio's built-in voice only on
// fallbacks; the screening conversation itself is the AI voice.

const hook = (path: string, call: string, extra = "") => xml(siteUrl(`/api/webhooks/twilio/redial/${path}?call=${call}${extra}`));

// Ring the member's phone with our number as caller ID, so they know it's a
// Redial call; a whisper asks them to press 1 before the caller is joined.
export function ringOwner(line: Line, callId: string, announce: boolean) {
  return `${announce ? `<Say>One moment while I connect you.</Say>` : ""}<Dial timeout="20" callerId="${xml(line.number)}" action="${hook("dial", callId)}"><Number url="${hook("whisper", callId)}">${xml(line.forward_to!)}</Number></Dial>`;
}

export function voicemail(callId: string, prompt: string) {
  return `<Say>${xml(prompt)}</Say><Record maxLength="120" playBeep="true" trim="trim-silence" action="${hook("dial", callId, "&done=1")}" recordingStatusCallback="${hook("recording", callId)}" recordingStatusCallbackEvent="completed"/><Say>Thanks. Goodbye.</Say><Hangup/>`;
}

export function stream(gatewayUrl: string, token: string, callId: string) {
  return `<Connect><Stream url="${xml(`${gatewayUrl}/twilio`)}"><Parameter name="token" value="${xml(token)}"/></Stream></Connect><Redirect method="POST">${hook("after", callId)}</Redirect>`;
}
