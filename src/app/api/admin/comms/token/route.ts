import { can, getStaff } from "@/lib/admin/guard";
import { callsReady, identityFor, phoneNumber, voiceToken } from "@/lib/comms/twilio";
import { getUser } from "@/lib/data";

// A one-hour Twilio Voice token for the admin browser phone. Staff with
// comms.manage only; 503 when calling isn't set up, so the phone stays hidden.
export async function GET() {
  const user = await getUser();
  const staff = user ? await getStaff() : null;
  if (!user || !staff?.mfaVerified || !can(staff, "comms.manage")) return Response.json({ error: "Not allowed." }, { status: 403 });
  if (!(await callsReady())) return Response.json({ error: "Calling isn't set up." }, { status: 503 });
  const identity = identityFor(user.id);
  return Response.json({ token: await voiceToken(identity), identity, number: await phoneNumber() }, { headers: { "cache-control": "no-store" } });
}
