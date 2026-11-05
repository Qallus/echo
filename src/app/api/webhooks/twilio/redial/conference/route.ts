import { twilioRequest, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { gatewayConfig } from "@/lib/redial/gateway";
import { addAgent, aiGone, liveEvent, memberFromLabel, removeAgent, transferFromLabel, type Session } from "@/lib/redial/live";
import { createAdminClient } from "@/lib/supabase/admin";

// Conference status callback for Redial conference calls (signed by Twilio),
// plus the AI leg's call status (leg=agent). Records who is on the call, adds
// the AI once the caller is in, and hands the caller back when the AI leaves.
// Listeners (Insider) join muted; if one is ever unmuted, they're muted again,
// except the person who took the call over (Gavel). When that person hangs
// up, the call ends for the caller too, unless it was transferred. When a
// transfer target joins (they pressed 1), the AI is removed for good.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (!isUuid(id)) return new Response(null, { status: 204 });
  const db = createAdminClient();
  const { data } = await db.from("redial_live_sessions").select("id, call_id, line_id, conference_sid, caller_call_sid, agent_call_sid, state, ai_state, taken_over_by, transferred_at, line:redial_lines(number)").eq("call_id", id).maybeSingle();
  if (!data) return new Response(null, { status: 204 });
  const s = data as unknown as Session & { transferred_at: string | null; line: { number: string } };

  // The AI leg ended. If it never joined the conference (no answer, error),
  // the leave event won't come, so hand the caller back here.
  if (url.searchParams.get("leg") === "agent") {
    if (s.ai_state === "joining" || s.ai_state === "pending") await aiGone(db, s, "failed", `AI leg ${p.CallStatus ?? "ended"} before joining`);
    return new Response(null, { status: 204 });
  }

  const now = new Date().toISOString();
  const label = p.ParticipantLabel ?? "";
  const member = memberFromLabel(label);
  const transfer = transferFromLabel(label);
  const role = label === "caller" || label === "agent" ? label : transfer ? "transfer" : "member";
  switch (p.StatusCallbackEvent) {
    case "conference-start":
      await db.from("redial_live_sessions").update({ conference_sid: p.ConferenceSid, state: "live" }).eq("id", s.id).eq("state", "starting");
      await liveEvent(db, s, "conference.start");
      break;
    case "participant-join": {
      if (!p.CallSid) break;
      // Join can arrive before conference-start; the controls need the SID.
      if (p.ConferenceSid) await db.from("redial_live_sessions").update({ conference_sid: p.ConferenceSid }).eq("id", s.id).is("conference_sid", null);
      await db.from("redial_live_participants").upsert({ session_id: s.id, line_id: s.line_id, role, call_sid: p.CallSid, user_id: member, muted: p.Muted === "true", status: "joined" }, { onConflict: "call_sid" });
      await liveEvent(db, s, "participant.join", { role }, member);
      if (role === "caller") {
        const gw = await gatewayConfig();
        if (gw.aiApp && p.ConferenceSid) await addAgent(db, { ...s, conference_sid: p.ConferenceSid }, p.ConferenceSid, gw.aiApp, s.line.number);
        else await aiGone(db, s, "failed", "AI participant app isn't set up");
      } else if (role === "agent") {
        await db.from("redial_live_sessions").update({ ai_state: "active", agent_call_sid: p.CallSid }).eq("id", s.id).eq("ai_state", "joining");
      } else if (transfer && p.ConferenceSid) {
        const { data: t } = await db.from("redial_transfers").update({ status: "connected" }).eq("id", transfer).eq("session_id", s.id).eq("status", "accepted").select("label").maybeSingle();
        if (t) {
          await db.from("redial_live_sessions").update({ transferred_at: now }).eq("id", s.id);
          await db.from("redial_calls").update({ status: "connected", reason: `Transferred to ${t.label}` }).eq("id", s.call_id).in("status", ["screening", "connected"]);
          await liveEvent(db, s, "transfer.connected", { transfer_id: transfer });
          await removeAgent(db, s, p.ConferenceSid);
        }
      }
      break;
    }
    case "participant-leave":
      if (!p.CallSid) break;
      await db.from("redial_live_participants").update({ status: "left", left_at: now }).eq("call_sid", p.CallSid);
      await liveEvent(db, s, "participant.leave", { role }, member);
      if (role === "agent") await aiGone(db, s, "left");
      if (transfer) await db.from("redial_transfers").update({ status: "ended", ended_at: now }).eq("id", transfer).eq("status", "connected");
      if (member && member === s.taken_over_by && !s.transferred_at && p.ConferenceSid) {
        await twilioRequest(`/Conferences/${p.ConferenceSid}.json`, { Status: "completed" });
        await liveEvent(db, s, "takeover.end", {}, member);
      }
      break;
    case "participant-mute":
    case "participant-unmute":
      if (!p.CallSid) break;
      await db.from("redial_live_participants").update({ muted: p.StatusCallbackEvent === "participant-mute" }).eq("call_sid", p.CallSid);
      if (member && member !== s.taken_over_by && p.StatusCallbackEvent === "participant-unmute" && p.ConferenceSid) {
        await twilioRequest(`/Conferences/${p.ConferenceSid}/Participants/${p.CallSid}.json`, { Muted: "true" });
        await liveEvent(db, s, "listen.remuted", {}, member);
      } else if (member && member === s.taken_over_by && p.StatusCallbackEvent === "participant-unmute") {
        await liveEvent(db, s, "takeover.speaking", {}, member);
      }
      break;
    case "conference-end":
      await db.from("redial_live_sessions").update({ state: "ended", ended_at: now }).eq("id", s.id);
      await db.from("redial_live_participants").update({ status: "left", left_at: now }).eq("session_id", s.id).eq("status", "joined");
      await liveEvent(db, s, "conference.end", { reason: p.ReasonConferenceEnded ?? null });
      break;
  }
  return new Response(null, { status: 204 });
}
