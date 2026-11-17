import { twilioRequest } from "@/lib/comms/twilio";
import { isUuid } from "@/lib/data";
import { verifyGateway } from "@/lib/redial/gateway";
import { codeWordFor, codeWordMatches, lineFamily, matchFamily, recordRisk, type Signal } from "@/lib/redial/protection";
import { CHECK_SIGNALS, RISK_CODES, RISK_SIGNALS, type RiskCode, type Verdict } from "@/lib/redial/protection-shared";
import { redialUrl } from "@/lib/redial/twiml";
import { createAdminClient } from "@/lib/supabase/admin";

// The assistant's fraud-protection tools, sent by the voice gateway (signed).
// check_code_word: answers only "matched" or not; two tries per call.
// call_back_check: calls the family member the caller claims to be, on their
//   saved number (Twilio -> /api/webhooks/twilio/redial/protect); the result
//   reaches the assistant later as a private note. Once per call.
// flag_risk: records warning signs and the verdict so far.
// Only calls still being screened, on lines with protection on.

type Body = { callId?: string; tool?: string; args?: { spoken?: unknown; person?: unknown; signals?: unknown; verdict?: unknown; note?: unknown } };
const check = (code: string): Signal => ({ code, detail: CHECK_SIGNALS[code] ?? code });

export async function POST(req: Request) {
  const body = (await verifyGateway(req)) as Body | null;
  if (!body?.callId || !isUuid(body.callId)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  const { data: call } = await db.from("redial_calls").select("id, line_id, status, risk_signals, line:redial_lines(number)").eq("id", body.callId).maybeSingle();
  if (!call || call.status !== "screening") return Response.json({ error: "This call isn't being screened." });
  const signals = (call.risk_signals ?? []) as Signal[];
  const a = body.args ?? {};

  if (body.tool === "check_code_word") {
    const word = await codeWordFor(db, call.line_id);
    if (!word) return Response.json({ error: "No code word is set up, so this can't be checked." });
    const tries = signals.filter((s) => s.code.startsWith("code_word_try")).length;
    if (signals.some((s) => s.code === "code_word_passed")) return Response.json({ matched: true });
    if (tries >= 2) return Response.json({ matched: false, tries_left: 0, note: "No more tries. Treat the caller as not verified." });
    const matched = typeof a.spoken === "string" && codeWordMatches(a.spoken, word);
    if (matched) {
      await recordRisk(db, call.id, [check("code_word_passed")]);
      return Response.json({ matched: true });
    }
    const add = [{ code: `code_word_try${tries + 1}`, detail: "Gave a code word that didn't match" }, ...(tries + 1 >= 2 ? [check("code_word_failed")] : [])];
    await recordRisk(db, call.id, add, tries + 1 >= 2 ? "unverified" : undefined);
    return Response.json(tries + 1 >= 2
      ? { matched: false, tries_left: 0, note: "That's not it, and there are no more tries. Treat the caller as not verified." }
      : { matched: false, tries_left: 1, note: "Not a match. You may ask once more, without hinting." });
  }

  if (body.tool === "call_back_check") {
    if (signals.some((s) => s.code === "callback_started")) return Response.json({ error: "A call-back check already ran on this call." });
    const family = (await lineFamily(db, call.line_id)).filter((f) => f.callback_ok && f.phone);
    const person = typeof a.person === "string" ? matchFamily(a.person, family) : null;
    if (!person) return Response.json({ started: false, note: "That person isn't saved with a number Redial may call, so this can't be checked. Treat the caller as not verified." });
    const from = (call.line as unknown as { number: string } | null)?.number;
    if (!from) return Response.json({ error: "Can't place the call." });
    const extra = `&f=${person.id}`;
    const r = await twilioRequest("/Calls.json", {
      To: person.phone!, From: from, Url: redialUrl("protect", call.id, extra), Method: "POST", Timeout: "25", MachineDetection: "Enable",
      StatusCallback: redialUrl("protect", call.id, `${extra}&step=status`), StatusCallbackEvent: "completed",
    });
    if (!r.ok) return Response.json({ started: false, note: "The check call couldn't be placed. Treat the caller as not verified." });
    await recordRisk(db, call.id, [{ code: "callback_started", detail: `Redial called ${person.name} to check` }]);
    return Response.json({ started: true, calling: person.name, note: `Calling ${person.name} now. Ask the caller to hold; the result comes as a private note.` });
  }

  if (body.tool === "flag_risk") {
    const codes = (Array.isArray(a.signals) ? a.signals : []).filter((c): c is RiskCode => typeof c === "string" && (RISK_CODES as string[]).includes(c));
    const verdict = (["legit", "unverified", "likely_scam"] as const).find((v) => v === a.verdict) as Verdict | undefined;
    const next = await recordRisk(db, call.id, codes.map((c) => ({ code: c, detail: RISK_SIGNALS[c] })), verdict);
    if (typeof a.note === "string" && a.note.trim()) {
      await db.from("redial_calls").update({ reason: `Protection: ${a.note.trim()}`.slice(0, 200) }).eq("id", call.id).eq("status", "screening");
    }
    return Response.json({ recorded: true, verdict: next, ...(next === "likely_scam" ? { note: "Don't put this call through. End it politely." } : {}) });
  }

  return Response.json({ error: "Unknown tool." });
}
