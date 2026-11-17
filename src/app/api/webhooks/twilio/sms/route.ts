import { contactForNumber, e164, twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

// Incoming text to Echo's number (Twilio "A message comes in" webhook).
// Signed by Twilio; then saved with the service role, matched to a CRM
// contact, and STOP / START honored (STOP also turns off that number's
// notification texts). Twilio sends its own opt-out confirmation.
// Fraud protection trusted contacts: YES after an invite turns on their scam
// alerts (and we confirm by text); STOP turns them off.

const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START = new Set(["START", "YES", "UNSTOP"]);

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const from = e164(p.From) ?? p.From ?? "";
  const body = (p.Body ?? "").slice(0, 2000);
  const db = createAdminClient();
  const keyword = body.trim().toUpperCase();

  let reply = "";
  if (STOP.has(keyword)) {
    await db.from("phone_opt_outs").upsert({ number: from }, { onConflict: "number", ignoreDuplicates: true });
    await db.from("notification_channels").update({ verified_at: null }).eq("kind", "sms").eq("address", from);
    await db.from("redial_trusted_contacts").update({ opted_out_at: new Date().toISOString(), sms_consent_at: null }).eq("phone", from).is("opted_out_at", null);
  } else if (START.has(keyword)) {
    await db.from("phone_opt_outs").delete().eq("number", from);
    if (keyword === "YES") reply = await trustedYes(db, from);
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
  return twiml(reply ? `<Message>${xml(reply)}</Message>` : "");
}

// A trusted contact replying YES to their invite. Consent is only ever set
// here, from their own reply.
async function trustedYes(db: ReturnType<typeof createAdminClient>, from: string) {
  const { data: rows } = await db.from("redial_trusted_contacts").update({ sms_consent_at: new Date().toISOString(), opted_out_at: null })
    .eq("phone", from).not("invited_at", "is", null).is("sms_consent_at", null).select("line_id");
  if (!rows?.length) return "";
  const { data: lines } = await db.from("redial_lines").select("owner_id").in("id", rows.map((r) => r.line_id));
  const { data: people } = await db.from("profiles").select("full_name").in("id", (lines ?? []).map((l) => l.owner_id));
  const names = [...new Set((people ?? []).map((p) => p.full_name?.trim().split(/\s+/)[0]).filter(Boolean))];
  return `You're set. Redial will text you if it stops a likely scam call to ${names.length ? names.join(" or ") : "your family member"}. Reply STOP anytime to stop.`;
}
