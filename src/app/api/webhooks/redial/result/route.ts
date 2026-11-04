import { isUuid } from "@/lib/data";
import { verifyGateway } from "@/lib/redial/gateway";
import type { Category, Turn } from "@/lib/redial/types";
import { redialUsage } from "@/lib/redial/usage";
import { createAdminClient } from "@/lib/supabase/admin";

// The voice gateway reports a call's outcome (signed). Sent when the
// assistant saves details, asks to connect, or the stream ends. Only calls
// that are still being screened can be changed, except the AI time, which
// is recorded once at the end and may trigger a low-minutes notification.
// `turn` is one line of the live transcript, sent as it's spoken.

type Body = {
  callId?: string; connect?: boolean; transcript?: Turn[]; aiSeconds?: number; turn?: Turn;
  details?: { caller_name?: string; purpose?: string; message?: string; callback_number?: string; category?: string; urgency?: string; summary?: string };
};

const CATEGORIES: Category[] = ["personal", "business", "sales", "spam", "unknown"];
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function POST(req: Request) {
  const body = (await verifyGateway(req)) as Body | null;
  if (!body?.callId || !isUuid(body.callId)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  if (body.turn) return liveTurn(db, body.callId, body.turn);
  if (typeof body.aiSeconds === "number" && body.aiSeconds > 0) await recordAiTime(db, body.callId, Math.min(3600, Math.round(body.aiSeconds)));
  const patch: Record<string, unknown> = {};
  if (Array.isArray(body.transcript)) {
    patch.transcript = body.transcript.filter((t) => (t.role === "caller" || t.role === "assistant") && typeof t.text === "string")
      .slice(-200).map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }));
  }
  if (body.details) {
    const d = body.details;
    Object.assign(patch, {
      caller_name: clip(d.caller_name, 120), purpose: clip(d.purpose, 1000), message: clip(d.message, 10000), callback_number: clip(d.callback_number, 40),
      category: CATEGORIES.includes(d.category as Category) ? d.category : "unknown", urgency: ["low", "normal", "high"].includes(d.urgency ?? "") ? d.urgency : "normal",
      summary: clip(d.summary, 2000) ?? clip(d.purpose, 2000) ?? "Screened call",
    });
  }
  if (body.connect) patch.connect_requested = true;
  if (!Object.keys(patch).length) return Response.json({ ok: true });
  // A call taken over from the assistant (Gavel) still gets its transcript
  // up to that point, but nothing the assistant decided.
  if (patch.transcript) await db.from("redial_calls").update({ transcript: patch.transcript }).eq("id", body.callId).eq("status", "connected");
  const { error } = await db.from("redial_calls").update(patch).eq("id", body.callId).eq("status", "screening");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

async function liveTurn(db: ReturnType<typeof createAdminClient>, callId: string, t: Turn) {
  const text = typeof t.text === "string" ? t.text.trim().slice(0, 2000) : "";
  if (!text || (t.role !== "caller" && t.role !== "assistant")) return Response.json({ ok: true });
  const { data: call } = await db.from("redial_calls").select("line_id").eq("id", callId).eq("status", "screening").maybeSingle();
  if (call) await db.from("redial_live_turns").insert({ call_id: callId, line_id: call.line_id, role: t.role, text });
  return Response.json({ ok: true });
}

// Saves the call's AI time once, then warns the owner at 80% and 100% of the
// month's screening minutes (one notification per level per month).
async function recordAiTime(db: ReturnType<typeof createAdminClient>, callId: string, seconds: number) {
  const { data: call } = await db.from("redial_calls").update({ ai_seconds: seconds }).eq("id", callId).is("ai_seconds", null).select("owner_id").maybeSingle();
  if (!call) return;
  const usage = await redialUsage(db, call.owner_id);
  if (!usage || !usage.allowance) return;
  const level = usage.used_minutes >= usage.allowance ? 100 : usage.used_minutes >= usage.allowance * 0.8 ? 80 : 0;
  if (!level) return;
  const period = usage.period_start.slice(0, 7);
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", call.owner_id).eq("type", "redial_usage").eq("data->>period", period).eq("data->>level", String(level));
  if (count) return;
  await db.from("notifications").insert({
    user_id: call.owner_id, type: "redial_usage", url: "/calls",
    title: level === 100 ? "Your screening minutes are used up" : "You've used 80% of your screening minutes",
    body: level === 100
      ? "Unknown callers go to voicemail until next month. Add minutes or upgrade to keep your assistant answering."
      : `${usage.used_minutes} of ${usage.allowance} minutes used this month.`,
    data: { period, level: String(level) },
  });
}
