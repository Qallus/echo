import { twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";
import { autoStartMirror } from "@/lib/redial/mirror";
import { createAdminClient } from "@/lib/supabase/admin";

// Played to the owner when they pick up, before the caller is joined: who's
// calling and why, then "press 1 to take it". Anything else (or voicemail
// answering) hangs up this leg and the caller goes to a message. Pressing 1
// also starts Mirror if the line has it on and set to start by itself.

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("call") ?? "";
  if (!isUuid(id)) return twiml("<Hangup/>");
  if (url.searchParams.get("step") === "accept") {
    if (p.Digits !== "1") return twiml("<Hangup/>");
    await autoStartMirror(createAdminClient(), id).catch((e) => console.error("[mirror auto]", e instanceof Error ? e.message : e));
    return twiml("");
  }

  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("caller_name, caller_id_name, from_number, purpose").eq("id", id).maybeSingle();
  const who = call?.caller_name || call?.caller_id_name || (call?.from_number ? call.from_number.replace(/^\+1/, "").split("").join(" ") : "an unknown caller");
  const why = call?.purpose ? ` about ${call.purpose}` : "";
  const accept = xml(siteUrl(`/api/webhooks/twilio/redial/whisper?call=${id}&step=accept`));
  return twiml(`<Gather numDigits="1" timeout="6" action="${accept}"><Say>Echo call from ${xml(who)}${xml(why)}. Press 1 to take the call.</Say></Gather><Hangup/>`);
}
