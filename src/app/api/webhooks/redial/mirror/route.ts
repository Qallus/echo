import { after } from "next/server";
import { isUuid } from "@/lib/data";
import { verifyGateway } from "@/lib/redial/gateway";
import { suggest } from "@/lib/redial/mirror";
import { createAdminClient } from "@/lib/supabase/admin";

// Mirror lines from the voice gateway (signed): {callId, turn: {role:
// "caller" | "person", text}} as each one is transcribed, or {callId, ended}
// when the stream stops. Each line is added to the live transcript, then a
// suggestion round runs in the background.

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await verifyGateway(req)) as { callId?: string; turn?: { role?: string; text?: string }; ended?: boolean } | null;
  if (!body?.callId || !isUuid(body.callId)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  const callId = body.callId;
  if (body.ended) {
    await db.from("redial_mirror_sessions").update({ state: "stopped", stopped_at: new Date().toISOString() }).eq("call_id", callId).in("state", ["starting", "running"]);
    return Response.json({ ok: true });
  }
  const text = typeof body.turn?.text === "string" ? body.turn.text.trim().slice(0, 2000) : "";
  const role = body.turn?.role === "caller" ? "caller" : body.turn?.role === "person" ? "person" : null;
  if (!text || !role) return Response.json({ ok: true });
  const { data: m } = await db.from("redial_mirror_sessions").select("line_id").eq("call_id", callId).eq("state", "running").maybeSingle();
  if (!m) return Response.json({ ok: true });
  await db.from("redial_live_turns").insert({ call_id: callId, line_id: m.line_id, role, text });
  after(() => suggest(db, callId));
  return Response.json({ ok: true });
}
