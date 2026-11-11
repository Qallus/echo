import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callToken, gatewayConfig } from "./gateway";
import { conference, conferenceName, stream, voicemail } from "./twiml";
import type { Line } from "./types";
import { MIN_SECONDS_TO_SCREEN, redialUsage } from "./usage";

// Hands a call to the AI assistant (the same screening the voice webhook
// runs): a live conference when the line has live routing, otherwise a
// direct stream. Falls back to voicemail when the assistant isn't set up or
// this month's minutes are used up. Used by call trees (AI receptionist
// blocks and unconnected outputs).

export const VOICEMAIL_PROMPT = "Sorry, no one can take your call right now. Please leave your name, number and a message after the tone.";

export async function assistantTwiml(db: SupabaseClient, line: Line, callId: string, callSid: string): Promise<string> {
  const gw = await gatewayConfig();
  const usage = gw.ready ? await redialUsage(db, line.owner_id) : null;
  if (!gw.ready || !usage || usage.remaining_seconds < MIN_SECONDS_TO_SCREEN) return voicemail(callId, VOICEMAIL_PROMPT);
  await db.from("redial_calls").update({ status: "screening" }).eq("id", callId);
  if (line.live_routing && gw.aiApp) {
    const { error } = await db.from("redial_live_sessions").upsert(
      { call_id: callId, line_id: line.id, conference_name: conferenceName(callId), caller_call_sid: callSid },
      { onConflict: "call_id", ignoreDuplicates: true });
    if (!error) return conference(callId);
    console.error("[redial screen] live session", error.message);
  }
  return stream(gw.url!, callToken(gw.secret!, callId), callId);
}
