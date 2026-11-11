import { twiml, verifyTwilio } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { stepFlowRun } from "@/lib/flows/runner";
import { createAdminClient } from "@/lib/supabase/admin";

// Each step of a call tree reports back here (menu choices, dial results,
// voicemail, whispers). Signed by Twilio. See src/lib/flows/runner.ts.

export const maxDuration = 30;

export async function POST(req: Request) {
  const p = await verifyTwilio(req);
  if (!p) return new Response("Invalid signature", { status: 403 });
  const url = new URL(req.url);
  const run = url.searchParams.get("run") ?? "";
  const node = url.searchParams.get("node") ?? "";
  const ev = url.searchParams.get("ev") ?? "";
  if (!isUuid(run) || !/^[a-z][a-z0-9_]{0,39}$/.test(node)) return twiml("<Hangup/>");
  try {
    return twiml(await stepFlowRun(createAdminClient(), run, node, ev, p, url.searchParams));
  } catch (e) {
    console.error("[call tree step]", e instanceof Error ? e.message : e);
    return twiml("<Say>Sorry, something went wrong. Please call back in a moment.</Say><Hangup/>");
  }
}
