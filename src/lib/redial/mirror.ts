import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { twilioRequest } from "@/lib/comms/twilio";
import { logUsage, resolveCandidates, type ModelChoice, type Resolved } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import type { createAdminClient } from "@/lib/supabase/admin";
import { callToken, gatewayConfig } from "./gateway";

// Mirror (step 7): a silent assistant for the person on a call. Twilio streams
// both sides of the caller's call (a media stream, not a participant, so it
// can never be heard) to the voice gateway, which transcribes them and posts
// each line to /api/webhooks/redial/mirror. After a line, suggest() asks the
// AI for what would help right now, from the sources the line allows.

type Db = ReturnType<typeof createAdminClient>;
const streamName = (callId: string) => `mirror-${callId}`;

export type MirrorSettings = {
  line_id: string; enabled: boolean; auto_start: boolean; use_knowledge: boolean; use_history: boolean; use_directory: boolean;
  allow_sms: boolean; allow_email: boolean; knowledge: string | null;
};
export const MIRROR_DEFAULTS: Omit<MirrorSettings, "line_id"> = {
  enabled: false, auto_start: true, use_knowledge: true, use_history: true, use_directory: true, allow_sms: false, allow_email: false, knowledge: null,
};

// Opens the media stream on the caller's call (both tracks: inbound is the
// caller, outbound is what the caller hears, i.e. the person).
export async function openMirrorStream(callId: string, callerSid: string): Promise<{ ok: boolean; error?: string }> {
  const gw = await gatewayConfig();
  if (!gw.url || !gw.secret) return { ok: false, error: "The voice gateway isn't set up." };
  const r = await twilioRequest(`/Calls/${callerSid}/Streams.json`, {
    Url: `${gw.url}/mirror`, Name: streamName(callId), Track: "both_tracks",
    "Parameter1.Name": "token", "Parameter1.Value": callToken(gw.secret, callId),
  });
  return r.ok ? { ok: true } : { ok: false, error: String(r.data.message ?? `Twilio ${r.status}`) };
}

export async function closeMirrorStream(callId: string, callerSid: string) {
  const r = await twilioRequest(`/Calls/${callerSid}/Streams/${streamName(callId)}.json`, { Status: "stopped" });
  if (!r.ok && r.status !== 404) console.error("[mirror stop]", r.status, r.data.message);
}

// Starts Mirror from a webhook (no user session): the owner just accepted a
// put-through call and the line has Mirror set to start on its own.
export async function autoStartMirror(db: Db, callId: string) {
  const { data: call } = await db.from("redial_calls").select("id, line_id, twilio_sid, ended_at").eq("id", callId).maybeSingle();
  if (!call?.twilio_sid || call.ended_at) return;
  const { data: st } = await db.from("redial_mirror_settings").select("enabled, auto_start").eq("line_id", call.line_id).maybeSingle();
  if (!st?.enabled || !st.auto_start) return;
  const { error } = await db.from("redial_mirror_sessions").insert({ call_id: callId, line_id: call.line_id, state: "starting" });
  if (error) return; // already started
  const r = await openMirrorStream(callId, call.twilio_sid);
  if (!r.ok) await db.from("redial_mirror_sessions").update({ state: "failed", error: r.error?.slice(0, 500) ?? null, stopped_at: new Date().toISOString() }).eq("call_id", callId);
}

const schema = z.object({
  suggestions: z.array(z.object({
    kind: z.enum(["say", "answer", "info", "caution"]).describe("say: a line to say next; answer: the answer to something the caller asked; info: a fact or contact detail; caution: something to avoid or check"),
    title: z.string().describe("3-8 words"),
    body: z.string().describe("One or two short sentences the person can use right away."),
    source: z.enum(["call", "knowledge", "history", "directory"]).describe("Where it came from."),
  })).describe("0-3 new suggestions. Empty if nothing new would help right now."),
  draft: z.object({
    kind: z.enum(["none", "sms", "email"]),
    title: z.string().describe("e.g. 'Text them the booking link'"),
    subject: z.string().describe("Email subject, or empty for a text."),
    body: z.string().describe("The message to the caller, ready to send, signed with the person's first name."),
  }).describe("A text or email to the caller, only if they asked for something to be sent or it clearly helps now. Otherwise kind none."),
});

// One suggestion round (the claim keeps it to one at a time, every 6 s).
export async function suggest(db: Db, callId: string) {
  const { data: claimed } = await db.rpc("redial_mirror_claim", { p_call: callId });
  if (!claimed) return;
  try {
    await run(db, callId);
  } catch (e) {
    console.error("[mirror suggest]", e instanceof Error ? e.message : e);
  } finally {
    await db.from("redial_mirror_sessions").update({ busy_until: null, last_suggested_at: new Date().toISOString() }).eq("call_id", callId);
  }
}

async function run(db: Db, callId: string) {
  const { data: call } = await db.from("redial_calls").select("id, line_id, owner_id, from_number, caller_name, caller_id_name, purpose, summary, line:redial_lines(label, about, assistant_name)").eq("id", callId).maybeSingle();
  if (!call) return;
  const line = call.line as unknown as { label: string; about: string | null } | null;
  const { data: st } = await db.from("redial_mirror_settings").select("*").eq("line_id", call.line_id).maybeSingle<MirrorSettings>();
  const s = { ...MIRROR_DEFAULTS, ...(st ?? {}) };
  const [{ data: turns }, { data: earlier }, { data: directory }, { data: before }, { data: owner }] = await Promise.all([
    db.from("redial_live_turns").select("role, text").eq("call_id", callId).order("id", { ascending: false }).limit(40),
    s.use_history && call.from_number
      ? db.from("redial_calls").select("started_at, caller_name, purpose, summary, message").eq("line_id", call.line_id).eq("from_number", call.from_number).neq("id", callId).order("started_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    s.use_directory ? db.from("redial_directory").select("label, number, note").eq("line_id", call.line_id).order("sort") : Promise.resolve({ data: [] }),
    db.from("redial_mirror_suggestions").select("title").eq("call_id", callId).order("created_at", { ascending: false }).limit(30),
    db.from("profiles").select("full_name").eq("id", call.owner_id).maybeSingle(),
  ]);
  if (!turns?.length) return;
  const first = owner?.full_name?.trim().split(/\s+/)[0] || "the person";
  const transcript = [...turns].reverse().map((t) => `${t.role === "caller" ? "Caller" : t.role === "person" ? first : "Assistant"}: ${t.text}`).join("\n");
  const allowed = [s.allow_sms && "sms", s.allow_email && "email"].filter(Boolean) as string[];

  const sources = [
    s.use_knowledge && (line?.about || s.knowledge) ? `KNOWLEDGE (the business's own notes; the only source for products, prices, hours and policies):\n${[line?.about, s.knowledge].filter(Boolean).join("\n\n").slice(0, 20000)}` : null,
    earlier?.length ? `EARLIER CALLS FROM THIS NUMBER:\n${earlier.map((c) => `- ${c.started_at.slice(0, 10)}: ${c.summary || c.purpose || c.message || "no details"}`).join("\n")}` : null,
    directory?.length ? `DIRECTORY (people and numbers that may be shared or transferred to):\n${directory.map((d) => `- ${d.label}: ${d.number}${d.note ? ` (${d.note})` : ""}`).join("\n")}` : null,
  ].filter(Boolean).join("\n\n");

  const system = `You are Mirror, a silent assistant helping ${first} during a live phone call. The caller can't hear you; ${first} reads your suggestions on screen while talking.
Suggest only what helps right now: the next thing to say, an answer to what the caller just asked, a relevant fact or contact detail, or a caution.
Use only the call and the sources below. Never invent prices, policies, dates, names or numbers; if the sources don't have it, suggest asking or following up instead.
Keep each suggestion short enough to read at a glance. Don't repeat these earlier suggestions: ${(before ?? []).map((b) => `"${b.title}"`).join(", ") || "none"}.
${allowed.length ? `You may draft a ${allowed.join(" or ")} to the caller when they asked for something to be sent or it clearly helps; ${first} reviews it before it's sent.` : "Don't draft any messages (draft.kind must be none)."}
Caller: ${call.caller_name || call.caller_id_name || "unknown"}${call.purpose ? `, calling about ${call.purpose}` : ""}.${call.summary ? ` Screening summary: ${call.summary}` : ""}
${sources ? `\n${sources}` : ""}`;

  const settings = await getAiSettings(db);
  const order = (settings.summaryOrder as ModelChoice[]).filter((m, i, a) => !!m && a.indexOf(m) === i);
  const attempts: Resolved[] = [];
  for (const choice of order) attempts.push(...(await resolveCandidates(db, choice, { settings, keys: [] })));
  for (const [i, picked] of attempts.entries()) {
    const started = Date.now();
    try {
      const { output, usage } = await generateText({ model: picked.model, system, prompt: `The call so far (newest last):\n${transcript}`, output: Output.object({ schema }) });
      void logUsage(db, { feature: "mirror", resolved: picked, fallback: i > 0, settings, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, latencyMs: Date.now() - started });
      const seen = new Set((before ?? []).map((b) => b.title.toLowerCase()));
      type Row = { call_id: string; line_id: string; kind: string; title: string; body: string; source: string; subject?: string };
      const rows: Row[] = output.suggestions.slice(0, 3).filter((x) => x.title.trim() && x.body.trim() && !seen.has(x.title.trim().toLowerCase()))
        .map((x) => ({ call_id: callId, line_id: call.line_id, kind: x.kind, title: x.title.trim().slice(0, 120), body: x.body.trim().slice(0, 2000), source: x.source }));
      const d = output.draft;
      if (d.kind !== "none" && allowed.includes(d.kind) && d.body.trim()) {
        rows.push({ call_id: callId, line_id: call.line_id, kind: d.kind, title: (d.title.trim() || (d.kind === "sms" ? "Text the caller" : "Email the caller")).slice(0, 120),
          body: d.body.trim().slice(0, 2000), source: "call", ...(d.kind === "email" ? { subject: d.subject.trim().slice(0, 200) || "Following up on our call" } : {}) });
      }
      if (rows.length) await db.from("redial_mirror_suggestions").insert(rows);
      return;
    } catch (e) {
      const message = `${picked.label}: ${e instanceof Error ? e.message : String(e)}`;
      void logUsage(db, { feature: "mirror", resolved: picked, fallback: i > 0, settings, ok: false, error: message, latencyMs: Date.now() - started });
    }
  }
}
