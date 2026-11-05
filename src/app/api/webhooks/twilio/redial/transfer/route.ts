import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { liveEvent, tellAgent, type Session } from "@/lib/redial/live";
import { transferBriefing, transferJoin } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// Directory transfers (signed by Twilio). The call to the transfer target:
// * first request: a private briefing (who's calling and why), press 1;
// * step=accept: 1 joins them to the conference (the conference webhook then
//   removes the AI); anything else declines;
// * step=status: the target's call ended. If it never got as far as
//   accepting, the transfer failed and the AI (if still on) is told to let
//   the caller know and offer to take a message.

type Transfer = {
  id: string; call_id: string; session_id: string; line_id: string; label: string; status: string;
  destination: { note: string | null } | null;
  session: { state: string; ai_state: string; conference_name: string } | null;
  call: { caller_name: string | null; caller_id_name: string | null; from_number: string | null; purpose: string | null } | null;
  line: { label: string } | null;
};

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("t") ?? "";
  const step = url.searchParams.get("step");
  if (!isUuid(id)) return step === "status" ? new Response(null, { status: 204 }) : twiml("<Hangup/>");
  const db = createAdminClient();
  const { data } = await db.from("redial_transfers").select(`id, call_id, session_id, line_id, label, status, destination:redial_directory(note),
    session:redial_live_sessions(state, ai_state, conference_name), call:redial_calls(caller_name, caller_id_name, from_number, purpose), line:redial_lines(label)`)
    .eq("id", id).maybeSingle();
  const t = data as unknown as Transfer | null;
  if (!t) return step === "status" ? new Response(null, { status: 204 }) : twiml("<Hangup/>");
  const live = t.session?.state === "live";
  const now = new Date().toISOString();

  if (step === "status") {
    const outcome = p.CallStatus === "no-answer" || p.CallStatus === "busy" ? "no_answer" : p.CallStatus === "completed" ? "declined" : "failed";
    if (t.status === "ringing" || t.status === "accepted") {
      const { data: changed } = await db.from("redial_transfers").update({ status: outcome, ended_at: now }).eq("id", t.id).in("status", ["ringing", "accepted"]).select("id").maybeSingle();
      if (changed) await failed(db, t, outcome);
    }
    return new Response(null, { status: 204 });
  }

  if (step === "accept") {
    if (p.Digits === "1" && t.status === "ringing" && live && t.session) {
      await db.from("redial_transfers").update({ status: "accepted", answered_at: now }).eq("id", t.id).eq("status", "ringing");
      return twiml(transferJoin(t.session.conference_name, t.id));
    }
    const { data: changed } = await db.from("redial_transfers").update({ status: "declined", ended_at: now }).eq("id", t.id).eq("status", "ringing").select("id").maybeSingle();
    if (changed) await failed(db, t, "declined");
    return twiml(live ? "<Say>No problem. Goodbye.</Say><Hangup/>" : "<Say>Sorry, the caller has hung up.</Say><Hangup/>");
  }

  if (t.status !== "ringing" || !live) return twiml("<Say>Sorry, the caller has hung up.</Say><Hangup/>");
  if (p.CallSid) await db.from("redial_transfers").update({ twilio_sid: p.CallSid }).eq("id", t.id).is("twilio_sid", null);
  const c = t.call;
  const who = c?.caller_name || c?.caller_id_name || (c?.from_number ? c.from_number.replace(/^\+1/, "").split("").join(" ") : "an unknown caller");
  const briefing = `This is Echo, with a call transfer from ${t.line?.label && t.line.label !== "My line" ? t.line.label : "Redial"}. ${who} is calling${c?.purpose ? ` about ${c.purpose}` : ""}.${t.destination?.note ? ` ${t.destination.note}` : ""}`;
  return twiml(transferBriefing(t.call_id, t.id, briefing));
}

async function failed(db: ReturnType<typeof createAdminClient>, t: Transfer, outcome: string) {
  await liveEvent(db, { id: t.session_id, line_id: t.line_id } as Session, "transfer.failed", { transfer_id: t.id, outcome });
  if (t.session?.state === "live" && t.session.ai_state === "active") {
    await tellAgent(t.call_id, `The transfer to ${t.label} didn't go through (${outcome === "no_answer" ? "no answer" : "they couldn't take it"}). Tell the caller, and offer to take a message or arrange a callback.`);
  }
}
