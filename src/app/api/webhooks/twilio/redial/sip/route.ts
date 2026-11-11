import { twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { toE164 } from "@/lib/notify/senders";
import { createAdminClient } from "@/lib/supabase/admin";

// A call from a desk, cordless or Wi-Fi phone (the SIP domain's Voice URL).
// Signed by Twilio. The phone's SIP username says which line it belongs to;
// the call goes out with that line's number as caller ID. Dialing an
// extension on the line rings it. 911 always goes straight out.

const EMERGENCY = new Set(["911", "933"]);

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const user = (p.From ?? "").match(/^sip:([^@;]+)@/i)?.[1]?.toLowerCase() ?? "";
  const dialed = decodeURIComponent((p.To ?? "").match(/^sip:([^@;]+)@/i)?.[1] ?? "").replace(/[^\d+*#]/g, "");
  const db = createAdminClient();
  const { data: device } = user ? await db.from("redial_devices").select("line:redial_lines(id, number)").eq("sip_username", user).maybeSingle() : { data: null };
  const line = device?.line as unknown as { id: string; number: string } | null;
  if (!line) return twiml("<Say>This phone isn't set up with Redial yet.</Say><Hangup/>");

  if (EMERGENCY.has(dialed)) return twiml(`<Dial callerId="${xml(line.number)}"><Number>${dialed}</Number></Dial>`);

  if (/^[0-9]{2,6}$/.test(dialed)) {
    const { data: ext } = await db.from("redial_extensions").select("number, ring_seconds, directory:redial_directory(number)").eq("line_id", line.id).eq("ext", dialed).maybeSingle();
    const to = (ext?.directory as unknown as { number: string } | null)?.number ?? ext?.number;
    if (to) return twiml(`<Dial callerId="${xml(line.number)}" timeout="${ext!.ring_seconds}"><Number>${xml(to)}</Number></Dial>`);
  }
  const to = toE164(dialed);
  if (!to) return twiml("<Say>Sorry, that number isn't complete. Please dial the full number with the area code.</Say><Hangup/>");
  return twiml(`<Dial callerId="${xml(line.number)}"><Number>${xml(to)}</Number></Dial>`);
}
