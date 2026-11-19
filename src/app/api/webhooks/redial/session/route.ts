import { instructions, tools } from "@/lib/redial/assistant";
import { gatewayConfig, readCallToken, verifyGateway } from "@/lib/redial/gateway";
import { callFacts, protectBrief, type Signal } from "@/lib/redial/protection";
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
  const { data: call } = await db.from("redial_calls").select("id, status, from_number, owner_id, stir_verstat, line_type, risk_signals, line:redial_lines(*)").eq("id", id).maybeSingle();
  const line = call?.line as unknown as Line | null;
  if (!call || !line || call.status !== "screening") return Response.json({ error: "Call isn't screening." }, { status: 409 });
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", call.owner_id).maybeSingle();
  const first = profile?.full_name?.trim().split(/\s+/)[0] || "the person you called";
  const canConnect = line.allow_connect && Boolean(line.forward_to);
  const usage = await redialUsage(db, call.owner_id);
  if (!usage || usage.remaining_seconds < MIN_SECONDS_TO_SCREEN) return Response.json({ error: "No screening minutes left." }, { status: 409 });
  const maxSeconds = Math.max(MIN_SECONDS_TO_SCREEN, Math.min(line.max_seconds, usage.remaining_seconds));
  const protect = await protectBrief(db, line.id);
  // A call tree's AI receptionist block can add instructions and a time limit.
  const { data: run } = await db.from("call_flow_runs").select("vars").eq("call_id", call.id).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const flowVars = ((run?.vars as { flow?: Record<string, string> } | null)?.flow) ?? {};
  const extra = flowVars.ai_instructions?.trim();
  const treeMax = Number(flowVars.ai_max_minutes) * 60 || 0;
  const limit = treeMax ? Math.max(MIN_SECONDS_TO_SCREEN, Math.min(maxSeconds, treeMax)) : maxSeconds;

  return Response.json({
    callId: call.id, xaiKey, model: "grok-voice-latest", voice: line.voice, maxSeconds: limit,
    instructions: instructions(line, first, call.from_number, canConnect, callFacts(call as { risk_signals?: Signal[] | null }), protect)
      + (extra ? `\n\nFrom the call tree (the menu the caller went through): ${extra}` : ""),
    tools: tools(canConnect, protect),
  });
}
