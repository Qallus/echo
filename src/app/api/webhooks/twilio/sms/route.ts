import { contactForNumber, e164, twiml, verifyTwilio } from "@/lib/comms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

// Incoming text to Echo's number (Twilio "A message comes in" webhook).
// Signed by Twilio; then saved with the service role, matched to a CRM
// contact, and STOP / START honored (STOP also turns off that number's
// notification texts). Twilio sends its own opt-out confirmation.

const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START = new Set(["START", "YES", "UNSTOP"]);

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const from = e164(p.From) ?? p.From ?? "";
  const body = (p.Body ?? "").slice(0, 2000);
  const db = createAdminClient();
  const keyword = body.trim().toUpperCase();

  if (STOP.has(keyword)) {
    await db.from("phone_opt_outs").upsert({ number: from }, { onConflict: "number", ignoreDuplicates: true });
    await db.from("notification_channels").update({ verified_at: null }).eq("kind", "sms").eq("address", from);
  } else if (START.has(keyword)) {
    await db.from("phone_opt_outs").delete().eq("number", from);
  }

  const contact = await contactForNumber(db, from);
  const media = Array.from({ length: Math.min(Number(p.NumMedia ?? 0) || 0, 10) }, (_, i) => ({ url: p[`MediaUrl${i}`], type: p[`MediaContentType${i}`] }));
  const { error } = await db.from("phone_messages").upsert({
    direction: "inbound", from_number: from, to_number: e164(p.To) ?? p.To ?? "", body, status: "received", twilio_sid: p.MessageSid,
    media, contact_id: contact?.id ?? null, sent_by: null,
  }, { onConflict: "twilio_sid", ignoreDuplicates: true });
  if (error) return new Response(error.message, { status: 500 });

  if (contact) {
    await db.from("crm_activities").insert({
      kind: "sms", direction: "inbound", body: body || "(attachment)", from_addr: from, to_addr: p.To, status: "received",
      external_id: p.MessageSid, contact_id: contact.id, company_id: contact.company_id,
    }); // a retried webhook hits the unique (kind, external_id) index; that's fine
  }
  return twiml("");
}
