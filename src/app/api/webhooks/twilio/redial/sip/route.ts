import { twiml, verifyTwilio, xml } from "@/lib/comms/twilio";
import { toE164 } from "@/lib/notify/senders";
import { dialOut } from "@/lib/redial/twiml";
import type { Line } from "@/lib/redial/types";
import { createAdminClient } from "@/lib/supabase/admin";

// A call from a desk, cordless or Wi-Fi phone (the SIP domain's Voice URL).
// Signed by Twilio. The phone's SIP username says which line it belongs to;
// the call goes out with that line's number as caller ID. Dialing an
// extension on the line rings it. 911 always goes straight out.
// Every call is logged on the line (the call log); conversations are
// recorded when the line records calls, with the notice to the person called.

const EMERGENCY = new Set(["911", "933"]);
type DeskLine = Pick<Line, "id" | "number" | "owner_id" | "record_calls" | "record_notice">;

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const user = (p.From ?? "").match(/^sip:([^@;]+)@/i)?.[1]?.toLowerCase() ?? "";
  const dialed = decodeURIComponent((p.To ?? "").match(/^sip:([^@;]+)@/i)?.[1] ?? "").replace(/[^\d+*#]/g, "");
  const db = createAdminClient();
  const { data: device } = user ? await db.from("redial_devices").select("id, line:redial_lines(*)").eq("sip_username", user).maybeSingle() : { data: null };
  const line = device?.line as unknown as DeskLine | null;
  if (!line) return twiml("<Say>This phone isn't set up with Redial yet.</Say><Hangup/>");

  // The call log entry (best effort: a logging problem never stops a call).
  const log = async (to: string, record = true) => {
    const { data, error } = await db.from("redial_calls").upsert({
      line_id: line.id, owner_id: line.owner_id, twilio_sid: p.CallSid, direction: "outbound", from_number: line.number, to_number: to,
      device_id: device!.id, status: "ringing", reason: record ? "Called from a desk phone" : "Emergency call from a desk phone",
    }, { onConflict: "twilio_sid" }).select("id").single();
    if (error) console.error("[redial desk call log]", error.message);
    return data?.id ?? null;
  };

  if (EMERGENCY.has(dialed)) {
    await log(dialed, false);
    return twiml(`<Dial callerId="${xml(line.number)}"><Number>${dialed}</Number></Dial>`);
  }

  let to: string | null = null, timeout: number | undefined;
  if (/^[0-9]{2,6}$/.test(dialed)) {
    const { data: ext } = await db.from("redial_extensions").select("number, ring_seconds, directory:redial_directory(number)").eq("line_id", line.id).eq("ext", dialed).maybeSingle();
    to = (ext?.directory as unknown as { number: string } | null)?.number ?? ext?.number ?? null;
    timeout = ext?.ring_seconds;
  }
  to ??= toE164(dialed);
  if (!to) return twiml("<Say>Sorry, that number isn't complete. Please dial the full number with the area code.</Say><Hangup/>");
  const callId = await log(to);
  if (!callId) return twiml(`<Dial callerId="${xml(line.number)}"${timeout ? ` timeout="${timeout}"` : ""}><Number>${xml(to)}</Number></Dial>`);
  return twiml(dialOut(line, callId, to, timeout));
}
