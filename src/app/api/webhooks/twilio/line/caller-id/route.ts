import { verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

// Twilio's caller-ID check finished (StatusCallback of the validation
// request). Signed by Twilio. The only place a member's cell becomes verified.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const user = new URL(req.url).searchParams.get("user") ?? "";
  if (!isUuid(user)) return new Response(null, { status: 204 });
  const ok = p.VerificationStatus === "success";
  const db = createAdminClient();
  await db.from("call_line_phones").update({
    status: ok ? "verified" : "failed", caller_id_sid: ok ? p.OutgoingCallerIdSid ?? null : null,
    verified_at: ok ? new Date().toISOString() : null, validation_code: null,
  }).eq("user_id", user).neq("status", "verified");
  return new Response(null, { status: 204 });
}
