import { verifyTwilio } from "@/lib/comms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

// Delivery updates for texts sent from the admin (StatusCallback). Signed by Twilio.
export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  if (p.MessageSid && p.MessageStatus) {
    await createAdminClient().from("phone_messages")
      .update({ status: p.MessageStatus.slice(0, 40), error: p.ErrorCode ? `Twilio error ${p.ErrorCode}` : null })
      .eq("twilio_sid", p.MessageSid);
  }
  return new Response(null, { status: 204 });
}
