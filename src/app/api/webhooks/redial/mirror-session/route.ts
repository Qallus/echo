import { readCallToken, gatewayConfig, verifyGateway } from "@/lib/redial/gateway";
import { secrets } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// The voice gateway starts transcribing a Mirror stream (signed, with the
// stream's short-lived call token). Returns the transcription key and model,
// and marks Mirror as running. Only while Mirror is on and the call is live.

export async function POST(req: Request) {
  const body = (await verifyGateway(req)) as { token?: string } | null;
  const { secret } = await gatewayConfig();
  const id = body?.token && secret ? readCallToken(secret, body.token) : null;
  if (!id) return Response.json({ error: "Not allowed." }, { status: 403 });
  const s = await secrets("OPENAI_API_KEY", "MIRROR_TRANSCRIBE_MODEL");
  if (!s.OPENAI_API_KEY) return Response.json({ error: "Transcription isn't set up (OpenAI key)." }, { status: 409 });
  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("ended_at").eq("id", id).maybeSingle();
  const { data: m } = await db.from("redial_mirror_sessions").update({ state: "running" }).eq("call_id", id).in("state", ["starting", "running"]).select("id").maybeSingle();
  if (!call || call.ended_at || !m) return Response.json({ error: "Mirror isn't on for this call." }, { status: 409 });
  return Response.json({ callId: id, openaiKey: s.OPENAI_API_KEY, model: s.MIRROR_TRANSCRIBE_MODEL || "gpt-4o-transcribe" });
}
