import { voiceToken } from "@/lib/comms/twilio";
import { getUser } from "@/lib/data";
import { memberIdentity } from "@/lib/redial/live";
import { createClient } from "@/lib/supabase/server";

// A one-hour Twilio Voice token for the Phone dial pad: places calls from the
// signed-in member's own Redial lines (the voice webhook checks the line is
// theirs). Outgoing only; incoming calls keep ringing their phones as set up.
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const supabase = await createClient();
  const { count } = await supabase.from("redial_lines").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  if (!count) return Response.json({ error: "You don't have a Redial line yet." }, { status: 403 });
  const token = await voiceToken(memberIdentity(user.id), { incoming: false });
  if (!token) return Response.json({ error: "Calling from the browser isn't set up yet." }, { status: 503 });
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}
