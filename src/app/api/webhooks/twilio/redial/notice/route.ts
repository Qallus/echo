import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { RECORDING_NOTICE } from "@/lib/redial/twiml";

// Played to the person a desk phone calls, as they answer (the Dial's
// <Number url>), before the two sides are joined. Signed by Twilio.
export async function POST(req: Request) {
  if (!(await verifyTwilio(req))) return new Response("Invalid signature", { status: 403 });
  return twiml(`<Say>${RECORDING_NOTICE}</Say>`);
}
