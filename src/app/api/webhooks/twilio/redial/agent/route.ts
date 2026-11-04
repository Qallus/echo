import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { callToken, gatewayConfig, readListenTicket } from "@/lib/redial/gateway";
import { liveEvent, memberCan, memberIdentity, type Session } from "@/lib/redial/live";
import { agentStream, listenerJoin } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// Voice URL of the Redial TwiML App (REDIAL_AI_APP_SID). Signed by Twilio.
// Two kinds of call reach it:
// * the AI's leg joining a conference (?call=<id> from the participant's To):
//   stream it to the voice gateway;
// * a member's browser joining to listen (Insider) or to take over (Gavel),
//   with a signed ticket: re-check the permission and join them muted.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const db = createAdminClient();
  const gw = await gatewayConfig();
  if (p.ticket) return listen(db, gw.secret, p);

  const id = new URL(req.url).searchParams.get("call") ?? p.call ?? "";
  if (!isUuid(id)) return twiml("<Hangup/>");
  const { data: s } = await db.from("redial_live_sessions").select("id, ai_state, call:redial_calls(status)").eq("call_id", id).maybeSingle();
  const status = (s?.call as unknown as { status: string } | null)?.status;
  if (!s || s.ai_state !== "joining" || status !== "screening" || !gw.ready) return twiml("<Hangup/>");
  return twiml(agentStream(gw.url!, callToken(gw.secret!, id)));
}

const refuse = (why: string) => twiml(`<Say>${why}</Say><Hangup/>`);

async function listen(db: ReturnType<typeof createAdminClient>, secret: string | null, p: Record<string, string>) {
  const t = secret ? readListenTicket(secret, p.ticket) : null;
  // The browser's identity must be the member the ticket was issued to.
  if (!t || p.From !== `client:${memberIdentity(t.userId)}`) return refuse("Sorry, you can't join this call.");
  const { data } = await db.from("redial_live_sessions").select("id, call_id, line_id, conference_sid, conference_name, caller_call_sid, agent_call_sid, state, ai_state").eq("id", t.sessionId).maybeSingle();
  const s = data as (Session & { conference_name: string }) | null;
  if (!s || s.state !== "live") return refuse("This call has ended.");
  const allowed = (await memberCan(db, s.line_id, t.userId, "monitor_live")) || (await memberCan(db, s.line_id, t.userId, "takeover_live"));
  if (!allowed) return refuse("Sorry, you can't join this call.");
  await liveEvent(db, s, "listen.join", {}, t.userId);
  return twiml(listenerJoin(s.conference_name, t.userId));
}
