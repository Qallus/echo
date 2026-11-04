import { instructions, tools } from "@/lib/redial/assistant";
import { gatewayConfig, readCallToken, verifyGateway } from "@/lib/redial/gateway";
import type { Line } from "@/lib/redial/types";
import { MIN_SECONDS_TO_SCREEN, redialUsage } from "@/lib/redial/usage";
import { createAdminClient } from "@/lib/supabase/admin";

// The voice gateway asks how to run a call (signed with REDIAL_GATEWAY_SECRET,
// carrying the call's short-lived token from the TwiML). Returns the
// assistant's instructions, voice, tools and limits, and the xAI key.

export async function POST(req: Request) {
  const body = (await verifyGateway(req)) as { token?: string } | null;
  const { secret, xaiKey } = await gatewayConfig();
  const id = body?.token && secret ? readCallToken(secret, body.token) : null;
  if (!id || !xaiKey) return Response.json({ error: "Not allowed." }, { status: 403 });

  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("id, status, from_number, owner_id, line:redial_lines(*)").eq("id", id).maybeSingle();
  const line = call?.line as unknown as Line | null;
  if (!call || !line || call.status !== "screening") return Response.json({ error: "Call isn't screening." }, { status: 409 });
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", call.owner_id).maybeSingle();
  const first = profile?.full_name?.trim().split(/\s+/)[0] || "the person you called";
  const canConnect = line.allow_connect && Boolean(line.forward_to);
  const usage = await redialUsage(db, call.owner_id);
  if (!usage || usage.remaining_seconds < MIN_SECONDS_TO_SCREEN) return Response.json({ error: "No screening minutes left." }, { status: 409 });
  const maxSeconds = Math.max(MIN_SECONDS_TO_SCREEN, Math.min(line.max_seconds, usage.remaining_seconds));

  return Response.json({
    callId: call.id, xaiKey, model: "grok-voice-latest", voice: line.voice, maxSeconds,
    instructions: instructions(line, first, call.from_number, canConnect), tools: tools(canConnect),
  });
}
