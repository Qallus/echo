import "server-only";
import { twilioRequest } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import type { createAdminClient } from "@/lib/supabase/admin";
import { redialUrl } from "./twiml";

// Conference calls (step 2), for the webhooks only (service role). The caller
// and the AI are separate participants. When the AI leaves, the caller is
// handed to the same "after" TwiML as the direct path: ring the owner if the
// assistant asked to connect, voicemail if it never really ran, else hang up.

type Db = ReturnType<typeof createAdminClient>;
export type Session = {
  id: string; call_id: string; line_id: string; conference_sid: string | null; caller_call_sid: string | null;
  agent_call_sid: string | null; state: string; ai_state: string; taken_over_by?: string | null;
};

export async function liveEvent(db: Db, s: Session, kind: string, detail: Record<string, unknown> = {}, actor: string | null = null) {
  const { error } = await db.from("redial_live_events").insert({ session_id: s.id, line_id: s.line_id, kind, detail, actor_id: actor });
  if (error) console.error("[redial live event]", error.message);
}

// Adds the AI to the conference through the TwiML App (REDIAL_AI_APP_SID),
// once per call. The app's Voice URL (/redial/agent) streams it to the gateway.
export async function addAgent(db: Db, s: Session, conferenceSid: string, aiApp: string, from: string) {
  const { data: claimed } = await db.from("redial_live_sessions").update({ ai_state: "joining" }).eq("id", s.id).eq("ai_state", "pending").select("id").maybeSingle();
  if (!claimed) return;
  const r = await twilioRequest(`/Conferences/${conferenceSid}/Participants.json`, {
    From: from, To: `app:${aiApp}?call=${s.call_id}`, Label: "agent", Beep: "false",
    EndConferenceOnExit: "false", StartConferenceOnEnter: "true", Timeout: "15",
    StatusCallback: redialUrl("conference", s.call_id, "&leg=agent"), StatusCallbackEvent: "completed",
  });
  if (r.ok) { await liveEvent(db, s, "ai.joining"); return; }
  await aiGone(db, s, "failed", String(r.data.message ?? `Twilio ${r.status}`));
}

// The AI has left (or never made it). Hand the caller back exactly once.
// A takeover sets ai_state to "removed" first, so it never gets here.
export async function aiGone(db: Db, s: Session, state: "left" | "failed", error?: string) {
  const { data: claimed } = await db.from("redial_live_sessions").update({ ai_state: state, ...(error ? { error: error.slice(0, 500) } : {}) })
    .eq("id", s.id).in("ai_state", ["pending", "joining", "active"]).select("id").maybeSingle();
  if (!claimed) return;
  await liveEvent(db, s, state === "left" ? "ai.left" : "ai.failed", error ? { error: error.slice(0, 500) } : {});
  if (!s.caller_call_sid || s.state === "ended") return;
  const r = await twilioRequest(`/Calls/${s.caller_call_sid}.json`, { Url: redialUrl("after", s.call_id), Method: "POST" });
  // 404: the caller already hung up, so there's nothing to hand back.
  if (!r.ok && r.status !== 404) {
    console.error("[redial live handback]", r.status, r.data.message);
    await liveEvent(db, s, "handback.failed", { status: r.status });
  }
}

// Browser identities for Redial listeners: member_<user id without dashes>.
export const memberIdentity = (userId: string) => `member_${userId.replace(/-/g, "")}`;

// The participant label a member joins with (listen-<user id>), if any.
export function memberFromLabel(label: string): string | null {
  const id = label.startsWith("listen-") ? label.slice(7) : "";
  return isUuid(id) ? id : null;
}

// Owner, or granted this capability on the line (the service-role twin of
// private.redial_can, for webhooks that have no user session).
export async function memberCan(db: Db, lineId: string, userId: string, cap: string) {
  const [{ data: line }, { data: grant }] = await Promise.all([
    db.from("redial_lines").select("owner_id").eq("id", lineId).maybeSingle(),
    db.from("redial_line_grants").select("capabilities").eq("line_id", lineId).eq("user_id", userId).maybeSingle(),
  ]);
  return line?.owner_id === userId || Boolean(grant?.capabilities?.includes(cap));
}
