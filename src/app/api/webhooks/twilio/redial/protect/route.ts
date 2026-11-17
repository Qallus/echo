import { twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { tellAgent } from "@/lib/redial/live";
import { recordRisk, type Signal } from "@/lib/redial/protection";
import { CHECK_SIGNALS } from "@/lib/redial/protection-shared";
import { redialUrl } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// The call-back check (signed by Twilio): Redial calls the family member a
// caller claims to be, on their saved number, while the caller holds.
// * first request: answered by a person -> the question; voicemail -> no answer;
// * step=answer: 1 = "I'm safe, that's not me" (the caller is an impostor),
//   2 = "yes, that's really me calling";
// * step=status: the check call ended without an answer.
// The result is recorded on the screened call and told to the assistant.

type Db = ReturnType<typeof createAdminClient>;
type Outcome = "callback_disproved" | "callback_confirmed" | "callback_no_answer";

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const callId = url.searchParams.get("call") ?? "";
  const familyId = url.searchParams.get("f") ?? "";
  const step = url.searchParams.get("step");
  const quiet = () => (step === "status" ? new Response(null, { status: 204 }) : twiml("<Hangup/>"));
  if (!isUuid(callId) || !isUuid(familyId)) return quiet();

  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("id, owner_id, line_id").eq("id", callId).maybeSingle();
  const { data: person } = await db.from("redial_family").select("name, line_id").eq("id", familyId).maybeSingle();
  if (!call || !person || person.line_id !== call.line_id) return quiet();

  if (step === "status") {
    await settle(db, callId, person.name, "callback_no_answer");
    return new Response(null, { status: 204 });
  }

  if (step === "answer") {
    if (p.Digits === "1") {
      await settle(db, callId, person.name, "callback_disproved");
      return twiml("<Say>Thank you. Redial won't put that call through. You may want to check in with them yourself. Goodbye.</Say><Hangup/>");
    }
    if (p.Digits === "2") {
      await settle(db, callId, person.name, "callback_confirmed");
      return twiml("<Say>Thank you, we'll let them know it's you. Goodbye.</Say><Hangup/>");
    }
    await settle(db, callId, person.name, "callback_no_answer");
    return twiml("<Say>Sorry, we didn't get that. Goodbye.</Say><Hangup/>");
  }

  // Voicemail or a fax machine: nobody to ask.
  if (p.AnsweredBy && p.AnsweredBy !== "human" && p.AnsweredBy !== "unknown") {
    await settle(db, callId, person.name, "callback_no_answer");
    return twiml("<Hangup/>");
  }
  const { data: owner } = await db.from("profiles").select("full_name").eq("id", call.owner_id).maybeSingle();
  const ownerName = owner?.full_name?.trim().split(/\s+/)[0] || "your family member";
  const first = person.name.trim().split(/\s+/)[0];
  const question = `Hi ${first}, this is Redial, the call assistant for ${ownerName}. Someone is on the phone with ${ownerName} right now saying they're you. If you're safe and that is not you, press 1. If it really is you calling, press 2.`;
  return twiml(`<Gather numDigits="1" timeout="8" action="${xml(redialUrl("protect", callId, `&f=${familyId}&step=answer`))}" method="POST"><Say>${xml(question)}</Say><Pause length="1"/><Say>${xml(question)}</Say></Gather><Say>We didn't get an answer. Goodbye.</Say><Hangup/>`);
}

// Records the outcome once and tells the assistant, if it's still on the call.
async function settle(db: Db, callId: string, name: string, outcome: Outcome) {
  const { data } = await db.from("redial_calls").select("status, risk_signals").eq("id", callId).maybeSingle();
  const signals = (data?.risk_signals ?? []) as Signal[];
  if (!data || signals.some((s) => s.code === "callback_disproved" || s.code === "callback_confirmed" || s.code === "callback_no_answer")) return;
  await recordRisk(db, callId, [{ code: outcome, detail: CHECK_SIGNALS[outcome] }],
    outcome === "callback_disproved" ? "likely_scam" : outcome === "callback_confirmed" ? "legit" : "unverified");
  if (data.status !== "screening") return;
  const note = outcome === "callback_disproved"
    ? `Redial reached ${name} on their saved number. ${name} is safe and is NOT on this call, so this caller isn't who they say. This is a likely scam: don't share anything, say ${name}'s family will call them directly, save the details with category "spam", and end the call politely.`
    : outcome === "callback_confirmed"
      ? `Redial reached ${name} on their saved number and they confirmed it really is them calling. Treat the caller as verified.`
      : `Redial couldn't reach ${name} to check. Treat the caller as not verified: take a message and don't put the call through.`;
  await tellAgent(callId, note);
}
