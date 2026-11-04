import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { callToken, gatewayConfig } from "@/lib/redial/gateway";
import { agentStream } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// Voice URL of the AI participant TwiML App (REDIAL_AI_APP_SID). Twilio calls
// it when the AI's leg joins a Redial conference, with ?call=<id> from the
// participant's To. Signed by Twilio. Streams the leg to the voice gateway.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const id = new URL(req.url).searchParams.get("call") ?? p.call ?? "";
  if (!isUuid(id)) return twiml("<Hangup/>");
  const db = createAdminClient();
  const { data: s } = await db.from("redial_live_sessions").select("id, ai_state, call:redial_calls(status)").eq("call_id", id).maybeSingle();
  const status = (s?.call as unknown as { status: string } | null)?.status;
  const gw = await gatewayConfig();
  if (!s || s.ai_state !== "joining" || status !== "screening" || !gw.ready) return twiml("<Hangup/>");
  return twiml(agentStream(gw.url!, callToken(gw.secret!, id)));
}
