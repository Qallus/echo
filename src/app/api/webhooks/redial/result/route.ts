import { isUuid } from "@/lib/data";
import { verifyGateway } from "@/lib/redial/gateway";
import type { Category, Turn } from "@/lib/redial/types";
import { createAdminClient } from "@/lib/supabase/admin";

// The voice gateway reports a call's outcome (signed). Sent when the
// assistant saves details, asks to connect, or the stream ends. Only calls
// that are still being screened can be changed.

type Body = {
  callId?: string; connect?: boolean; transcript?: Turn[];
  details?: { caller_name?: string; purpose?: string; message?: string; callback_number?: string; category?: string; urgency?: string; summary?: string };
};

const CATEGORIES: Category[] = ["personal", "business", "sales", "spam", "unknown"];
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function POST(req: Request) {
  const body = (await verifyGateway(req)) as Body | null;
  if (!body?.callId || !isUuid(body.callId)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
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
  const { error } = await db.from("redial_calls").update(patch).eq("id", body.callId).eq("status", "screening");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
