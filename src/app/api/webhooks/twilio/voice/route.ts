import { contactForNumber, e164, identityFor, phoneNumber, twiml, userFromIdentity, verifyTwilio, xml } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { startTestRun } from "@/lib/flows/runner";
import { readTestTicket } from "@/lib/flows/test-call";
import { createAdminClient } from "@/lib/supabase/admin";

// Call routing (TwiML). Used as both the TwiML App's Voice URL (calls placed
// from the browser phone: From = client:staff_…) and the number's "A call
// comes in" URL (From = the caller). Signed by Twilio. No announcement is
// played; calls are recorded from answer, both sides on separate channels.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const db = createAdminClient();
  const ours = (await phoneNumber()) ?? "";
  const fromClient = (p.From ?? "").startsWith("client:");

  // A Call Tree test call from the builder: run the call tree's draft.
  if (fromClient && p.TreeTest) {
    const flowId = await readTestTicket(p.TreeTest);
    if (!flowId) return twiml("<Say>This test call has expired. Start it again from Call Tree.</Say><Hangup/>");
    return twiml(await startTestRun(db, flowId, p.CallSid));
  }

  if (fromClient) {
    const to = e164(p.To);
    if (!to) return twiml("<Say>That number isn't valid.</Say><Hangup/>");
    const staffId = userFromIdentity(p.From);
    const contact = isUuid(p.ContactId ?? "") ? { id: p.ContactId, company_id: null } : await contactForNumber(db, to);
    const { data: call } = await db.from("phone_calls").insert({
      direction: "outbound", from_number: ours, to_number: to, status: "ringing", twilio_sid: p.CallSid, staff_id: staffId,
      contact_id: contact?.id ?? null, deal_id: isUuid(p.DealId ?? "") ? p.DealId : null,
    }).select("id").single();
    const id = call?.id ?? "";
    return twiml(`<Dial callerId="${xml(ours)}" record="record-from-answer-dual" action="${xml(siteUrl(`/api/webhooks/twilio/voice-status?call=${id}`))}" recordingStatusCallback="${xml(siteUrl(`/api/webhooks/twilio/recording?call=${id}`))}" recordingStatusCallbackEvent="completed"><Number>${xml(to)}</Number></Dial>`);
  }

  // Incoming: ring every staff browser that can take calls, then voicemail.
  const from = e164(p.From) ?? p.From ?? "unknown";
  const contact = await contactForNumber(db, from);
  const { data: call } = await db.from("phone_calls").insert({
    direction: "inbound", from_number: from, to_number: ours, status: "ringing", twilio_sid: p.CallSid, contact_id: contact?.id ?? null,
  }).select("id").single();
  const id = call?.id ?? "";
  const { data: staff } = await db.from("platform_staff").select("user_id, role");
  const { data: perms } = await db.rpc("staff_roles_with", { p_permission: "comms.manage" });
  const allowed = new Set((perms ?? []) as string[]);
  const clients = (staff ?? []).filter((s) => allowed.has(s.role)).map((s) => `<Client>${identityFor(s.user_id)}</Client>`).join("");
  const action = xml(siteUrl(`/api/webhooks/twilio/voice-status?call=${id}&inbound=1`));
  if (!clients) return twiml(`<Redirect method="POST">${action}</Redirect>`);
  return twiml(`<Dial timeout="25" record="record-from-answer-dual" action="${action}" recordingStatusCallback="${xml(siteUrl(`/api/webhooks/twilio/recording?call=${id}`))}" recordingStatusCallbackEvent="completed">${clients}</Dial>`);
}
