import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { phoneNumber, xml } from "@/lib/comms/twilio";
import { siteUrl, toE164 } from "@/lib/notify/senders";
import { assistantTwiml, VOICEMAIL_PROMPT } from "@/lib/redial/screen";
import { redialUrl, voicemail } from "@/lib/redial/twiml";
import type { Line } from "@/lib/redial/types";
import { BLOCKS, flowSchema, type Flow, type FlowNode } from "./schema";
import { emptyVars, hoursOut, matchOption, render, splitOut, type Vars } from "./eval";
import { callWebhook } from "./http";

// Runs a call through its line's published call tree. Twilio asks what to do
// at each step: server-side blocks (hours, split, variables, webhooks) run
// right away, and the first block that needs the caller returns TwiML whose
// action URL comes back here (/api/webhooks/twilio/flow/step). Every block
// visited is logged in call_flow_run_steps. Runs with the service role, from
// Twilio-signed webhooks only.

const MAX_HOPS = 25;
const MAX_TRIES = 2;
const BUCKET = "studio-audio";

type Run = { id: string; flow_id: string; version_id: string | null; line_id: string | null; call_id: string | null; call_sid: string; vars: Vars; current_node: string | null };
// `test`: a browser test call of the draft (no version). AI, voicemail and
// callbacks are stood in for; nothing is saved to the line's calls.
type Ctx = { db: SupabaseClient; run: Run; flow: Flow; ownerId: string; line: Line; seq: number; test: boolean };

const stepUrl = (run: string, node: string, ev: string, extra = "") => siteUrl(`/api/webhooks/twilio/flow/step?run=${run}&node=${encodeURIComponent(node)}&ev=${ev}${extra}`);
const hook = (run: string, node: string, ev: string, extra = "") => xml(stepUrl(run, node, ev, extra));

// The published call tree on a line, if there is one.
export async function lineFlow(db: SupabaseClient, lineId: string) {
  const { data } = await db.from("call_flow_lines").select("flow:call_flows(id, name, owner_id, published_version_id)").eq("line_id", lineId).maybeSingle();
  const f = data?.flow as unknown as { id: string; name: string; owner_id: string; published_version_id: string | null } | null;
  return f?.published_version_id ? f : null;
}

async function loadVersion(db: SupabaseClient, versionId: string): Promise<Flow | null> {
  const { data } = await db.from("call_flow_versions").select("definition").eq("id", versionId).maybeSingle();
  const parsed = data ? flowSchema.safeParse(data.definition) : null;
  return parsed?.success ? parsed.data : null;
}

// A new call: create the run and walk from Incoming call.
export async function startFlowRun(db: SupabaseClient, f: { id: string; owner_id: string; published_version_id: string | null }, line: Line, call: { id: string; sid: string; from: string | null; callerName: string | null; to: string }): Promise<string> {
  const flow = f.published_version_id ? await loadVersion(db, f.published_version_id) : null;
  if (!flow) return assistantTwiml(db, line, call.id, call.sid);
  const vars = emptyVars({ from: call.from ?? "", callerName: call.callerName ?? "", to: call.to }, { name: line.label, number: line.number });
  const { data: run, error } = await db.from("call_flow_runs").insert({
    flow_id: f.id, version_id: f.published_version_id, line_id: line.id, call_id: call.id, call_sid: call.sid, from_number: call.from, vars,
  }).select("id, flow_id, version_id, line_id, call_id, call_sid, vars, current_node").single();
  if (error || !run) {
    console.error("[call tree] start", error?.message);
    return assistantTwiml(db, line, call.id, call.sid);
  }
  const ctx: Ctx = { db, run: run as Run, flow, ownerId: f.owner_id, line, seq: 0, test: false };
  return finish(ctx, await advance(ctx, flow.start));
}

// The line a test call uses: the owner's first line (so extensions and the
// Directory work), or a stand-in on the platform number.
async function testLine(db: SupabaseClient, ownerId: string, name: string): Promise<Line> {
  const { data } = await db.from("redial_lines").select("*").eq("owner_id", ownerId).order("created_at").limit(1).maybeSingle<Line>();
  return data ?? ({ id: "", owner_id: ownerId, label: name, number: (await phoneNumber()) ?? "", forward_to: null, live_routing: false } as unknown as Line);
}

async function loadDraft(db: SupabaseClient, flowId: string): Promise<{ flow: Flow; ownerId: string } | null> {
  const { data } = await db.from("call_flows").select("owner_id, draft").eq("id", flowId).maybeSingle();
  const parsed = data ? flowSchema.safeParse(data.draft) : null;
  return parsed?.success && data ? { flow: parsed.data, ownerId: data.owner_id } : null;
}

// A browser test call of a call tree's current draft.
export async function startTestRun(db: SupabaseClient, flowId: string, callSid: string): Promise<string> {
  const d = await loadDraft(db, flowId);
  if (!d) return "<Say>That call tree couldn't be loaded.</Say><Hangup/>";
  const line = await testLine(db, d.ownerId, d.flow.name);
  const vars = emptyVars({ from: "test", callerName: "Test call", to: line.number }, { name: line.label, number: line.number });
  const { data: run, error } = await db.from("call_flow_runs").insert({
    flow_id: flowId, version_id: null, line_id: line.id || null, call_id: null, call_sid: callSid, from_number: "Test call", vars,
  }).select("id, flow_id, version_id, line_id, call_id, call_sid, vars, current_node").single();
  if (error || !run) return "<Say>The test call couldn't start.</Say><Hangup/>";
  const ctx: Ctx = { db, run: run as Run, flow: d.flow, ownerId: d.ownerId, line, seq: 0, test: true };
  return finish(ctx, `<Say>Test call of ${xml(d.flow.name)}.</Say>${await advance(ctx, d.flow.start)}`);
}

// Twilio came back from a caller-facing block (`ev` says which kind).
export async function stepFlowRun(db: SupabaseClient, runId: string, nodeId: string, ev: string, p: Record<string, string>, extra: URLSearchParams): Promise<string> {
  const { data: run } = await db.from("call_flow_runs").select("id, flow_id, version_id, line_id, call_id, call_sid, vars, current_node").eq("id", runId).maybeSingle();
  if (!run) return "<Hangup/>";
  const test = !run.version_id;
  const [{ data: flowRow }, flow, { count }] = await Promise.all([
    db.from("call_flows").select("owner_id, name").eq("id", run.flow_id).maybeSingle(),
    run.version_id ? loadVersion(db, run.version_id) : loadDraft(db, run.flow_id).then((d) => d?.flow ?? null),
    db.from("call_flow_run_steps").select("id", { count: "exact", head: true }).eq("run_id", runId),
  ]);
  if (!flowRow || !flow) return "<Hangup/>";
  const line = run.line_id
    ? (await db.from("redial_lines").select("*").eq("id", run.line_id).maybeSingle<Line>()).data
    : test ? await testLine(db, flowRow.owner_id, flowRow.name) : null;
  if (!line) return "<Hangup/>";
  const ctx: Ctx = { db, run: run as Run, flow, ownerId: flowRow.owner_id, line, seq: count ?? 0, test };
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return finish(ctx, await unconnected(ctx));
  return finish(ctx, await resume(ctx, node, ev, p, extra));
}

async function finish(ctx: Ctx, inner: string): Promise<string> {
  await ctx.db.from("call_flow_runs").update({ vars: ctx.run.vars, current_node: ctx.run.current_node }).eq("id", ctx.run.id);
  return inner;
}

async function logStep(ctx: Ctx, node: FlowNode, transition: string | null, data: Record<string, unknown> = {}) {
  ctx.seq += 1;
  await ctx.db.from("call_flow_run_steps").insert({ run_id: ctx.run.id, seq: ctx.seq, node_id: node.id, node_type: node.type, transition, data });
}

async function complete(ctx: Ctx, status: "completed" | "failed" = "completed") {
  await ctx.db.from("call_flow_runs").update({ status, ended_at: new Date().toISOString() }).eq("id", ctx.run.id);
}

// Walk from `nodeId` until a block needs the caller.
async function advance(ctx: Ctx, start: string | undefined, hops = 0): Promise<string> {
  let nodeId = start;
  for (let h = hops; h < MAX_HOPS; h++) {
    const node = nodeId ? ctx.flow.nodes.find((n) => n.id === nodeId) : undefined;
    if (!node) return unconnected(ctx);
    ctx.run.current_node = node.id;
    const cfg = node.config as Record<string, unknown>;
    const vars = ctx.run.vars;
    let out: string | null = null;
    switch (node.type) {
      case "trigger.call": out = "next"; break;
      case "hours": out = hoursOut(cfg as Parameters<typeof hoursOut>[0], new Date()); break;
      case "split": out = splitOut(cfg.rules as Parameters<typeof splitOut>[0], vars); break;
      case "set":
        for (const v of (cfg.vars as { key: string; value: string }[]) ?? []) vars.flow[v.key] = render(v.value, vars).slice(0, 500);
        out = "next";
        break;
      case "http": {
        const r = await callWebhook(cfg as Parameters<typeof callWebhook>[0], vars);
        vars.blocks[node.id] = r;
        out = r.ok ? "success" : "failed";
        break;
      }
      case "flow": {
        const target = await ctx.db.from("call_flows").select("published_version_id, owner_id").eq("id", String(cfg.flowId)).maybeSingle();
        const next = target.data?.owner_id === ctx.ownerId && target.data.published_version_id ? await loadVersion(ctx.db, target.data.published_version_id) : null;
        await logStep(ctx, node, next ? "continued" : "missing");
        if (!next) return unconnected(ctx);
        ctx.flow = next;
        ctx.run.version_id = target.data!.published_version_id;
        await ctx.db.from("call_flow_runs").update({ version_id: ctx.run.version_id }).eq("id", ctx.run.id);
        nodeId = next.start;
        continue;
      }
      // Not available yet on calls: take the "nothing happened" output.
      case "crm_lookup": out = "notFound"; break;
      case "crm_update": out = "next"; break;
      case "message": out = "failed"; break;
      case "human": out = "none"; break;
      case "queue": out = "timedOut"; break;
      default:
        return enter(ctx, node);
    }
    await logStep(ctx, node, out);
    nodeId = node.next[out];
  }
  console.error("[call tree] too many steps without the caller", ctx.run.id);
  await complete(ctx, "failed");
  return `<Say>Sorry, something went wrong.</Say>${lineVoicemail(ctx, VOICEMAIL_PROMPT)}`;
}

const TEST_AI = "<Say>This is where your AI assistant takes the call. The test call ends here.</Say><Hangup/>";
const testVoicemail = (prompt = "") => `${prompt || "<Say>This is where callers leave a message.</Say>"}<Record maxLength="20" playBeep="true" trim="trim-silence"/><Say>On a real call, that message would be saved and transcribed. Goodbye.</Say><Hangup/>`;

// The AI assistant and voicemail, or their stand-ins on a test call.
const assistant = (ctx: Ctx) => (ctx.test ? Promise.resolve(TEST_AI) : assistantTwiml(ctx.db, ctx.line, ctx.run.call_id!, ctx.run.call_sid));
const lineVoicemail = (ctx: Ctx, prompt: string) => (ctx.test ? testVoicemail() : voicemail(ctx.run.call_id!, prompt));

// An output with nothing connected: the call tree's fallback setting.
async function unconnected(ctx: Ctx): Promise<string> {
  const mode = ctx.flow.settings.onUnconnected;
  if (mode === "goodbye") { await complete(ctx); return "<Say>Thanks for calling. Goodbye.</Say><Hangup/>"; }
  await complete(ctx);
  if (mode === "voicemail") return lineVoicemail(ctx, VOICEMAIL_PROMPT);
  return assistant(ctx);
}

type Prompt = { audioId?: string; text?: string } | undefined;

// <Play> a Studio clip (only the call tree owner's) or <Say> the text.
async function promptTwiml(ctx: Ctx, prompt: Prompt, loop = 1): Promise<string> {
  if (!prompt) return "";
  if (prompt.audioId) {
    const { data: clip } = await ctx.db.from("studio_audio").select("storage_path, owner_id").eq("id", prompt.audioId).maybeSingle();
    if (clip && clip.owner_id === ctx.ownerId) {
      const { data } = await ctx.db.storage.from(BUCKET).createSignedUrl(clip.storage_path, 3600);
      if (data?.signedUrl) return `<Play loop="${loop}">${xml(data.signedUrl)}</Play>`;
    }
  }
  const text = render(prompt.text ?? "", ctx.run.vars).trim();
  return text ? `<Say loop="${loop}">${xml(text)}</Say>` : "";
}

// Start a caller-facing block.
async function enter(ctx: Ctx, node: FlowNode): Promise<string> {
  const cfg = node.config as Record<string, unknown>;
  const run = ctx.run.id;
  switch (node.type) {
    case "say":
      await logStep(ctx, node, "next");
      return `${await promptTwiml(ctx, cfg.prompt as Prompt, Number(cfg.loop) || 1)}<Redirect method="POST">${hook(run, node.id, "next")}</Redirect>`;
    case "gather": {
      const options = (cfg.options as { key?: string }[]) ?? [];
      const input = ((cfg.input as string[]) ?? ["dtmf"]).join(" ");
      const ext = Boolean(cfg.extensions);
      const hints = ((cfg.options as { speech?: string[] }[]) ?? []).flatMap((o) => o.speech ?? []).join(", ");
      const attrs = [
        `input="${input}"`, `action="${hook(run, node.id, "gather")}"`, `method="POST"`, `actionOnEmptyResult="false"`,
        ext ? `timeout="3" finishOnKey="#"` : `timeout="${Number(cfg.timeout) || 5}"`,
        !ext && options.every((o) => !o.key || o.key.length === 1) ? `numDigits="1"` : "",
        input.includes("speech") ? `speechTimeout="auto"${hints ? ` hints="${xml(hints.slice(0, 900))}"` : ""}` : "",
      ].filter(Boolean).join(" ");
      return `<Gather ${attrs}>${await promptTwiml(ctx, cfg.prompt as Prompt)}</Gather><Redirect method="POST">${hook(run, node.id, "noinput")}</Redirect>`;
    }
    case "connect": return dialTargets(ctx, node, 0);
    case "voicemail": {
      const prompt = (await promptTwiml(ctx, cfg.prompt as Prompt)) || `<Say>${xml(VOICEMAIL_PROMPT)}</Say>`;
      if (ctx.test) { await logStep(ctx, node, "recorded", { test: true }); await complete(ctx); return testVoicemail(prompt); }
      return `${prompt}<Record maxLength="${Number(cfg.maxSeconds) || 120}" playBeep="true" trim="trim-silence" action="${hook(run, node.id, "record")}" recordingStatusCallback="${xml(redialUrl("recording", ctx.run.call_id!))}" recordingStatusCallbackEvent="completed"/>`;
    }
    case "callback": {
      const from = ctx.run.vars.call.from;
      if (!ctx.test && ctx.line.id) await ctx.db.from("redial_callbacks").insert({
        owner_id: ctx.line.owner_id, line_id: ctx.line.id, call_id: ctx.run.call_id, number: from || null, name: ctx.run.vars.call.callerName || null,
        due_at: new Date().toISOString(), timezone: ctx.flow.settings.timezone, note: `Callback requested in the call tree "${ctx.flow.name}".`,
      });
      await logStep(ctx, node, "saved");
      const prompt = (await promptTwiml(ctx, cfg.prompt as Prompt)) || "<Say>Thanks. We'll call you back as soon as we can.</Say>";
      return `${prompt}<Redirect method="POST">${hook(run, node.id, "next", "&out=saved")}</Redirect>`;
    }
    case "ai":
      await logStep(ctx, node, "handoff");
      await complete(ctx);
      return assistant(ctx);
    case "hangup":
      await logStep(ctx, node, null);
      await complete(ctx);
      await ctx.db.from("redial_calls").update({ status: "completed" }).eq("id", ctx.run.call_id).in("status", ["ringing"]);
      return `${await promptTwiml(ctx, cfg.prompt as Prompt)}<Hangup/>`;
    default:
      return unconnected(ctx);
  }
}

// Numbers to ring for a Connect block (the owner's extensions and Directory only).
async function resolveTargets(ctx: Ctx, targets: { directoryId?: string; extensionId?: string; number?: string }[]) {
  const out: { number: string; seconds?: number }[] = [];
  for (const t of targets) {
    if (t.number) { const n = toE164(t.number); if (n) out.push({ number: n }); continue; }
    if (t.extensionId) {
      const { data: e } = await ctx.db.from("redial_extensions").select("number, ring_seconds, directory:redial_directory(number), line:redial_lines(owner_id)").eq("id", t.extensionId).maybeSingle();
      const line = e?.line as unknown as { owner_id: string } | null;
      const dir = e?.directory as unknown as { number: string } | null;
      const n = dir?.number ?? e?.number;
      if (e && line?.owner_id === ctx.line.owner_id && n) out.push({ number: n, seconds: e.ring_seconds });
      continue;
    }
    if (t.directoryId) {
      const { data: d } = await ctx.db.from("redial_directory").select("number, line:redial_lines(owner_id)").eq("id", t.directoryId).maybeSingle();
      if (d && (d.line as unknown as { owner_id: string } | null)?.owner_id === ctx.line.owner_id) out.push({ number: d.number });
    }
  }
  return out;
}

async function dialTargets(ctx: Ctx, node: FlowNode, index: number, extraParams = ""): Promise<string> {
  const cfg = node.config as { targets: { directoryId?: string; extensionId?: string; number?: string }[]; mode: string; ringSeconds: number; whisper?: string };
  const targets = await resolveTargets(ctx, cfg.targets ?? []);
  const pick = cfg.mode === "all" ? targets : targets.slice(index, index + 1);
  if (!pick.length) {
    await logStep(ctx, node, "failed", { reason: "nobody to ring" });
    return advance(ctx, node.next.failed);
  }
  const whisper = cfg.whisper ? ` url="${hook(ctx.run.id, node.id, "whisper")}"` : "";
  const seconds = pick[0].seconds ?? cfg.ringSeconds ?? 20;
  const numbers = pick.map((t) => `<Number${whisper}>${xml(t.number)}</Number>`).join("");
  await ctx.db.from("redial_calls").update({ status: "connecting" }).eq("id", ctx.run.call_id);
  return `<Dial timeout="${seconds}" callerId="${xml(ctx.line.number)}" action="${hook(ctx.run.id, node.id, "dial", `&i=${index}${extraParams}`)}">${numbers}</Dial>`;
}

// What happened in the block Twilio is reporting on.
async function resume(ctx: Ctx, node: FlowNode, ev: string, p: Record<string, string>, extra: URLSearchParams): Promise<string> {
  const cfg = node.config as Record<string, unknown>;
  const vars = ctx.run.vars;
  const go = async (out: string, data: Record<string, unknown> = {}) => { await logStep(ctx, node, out, data); return advance(ctx, node.next[out]); };

  switch (ev) {
    case "next": return advance(ctx, node.next[extra.get("out") ?? "next"]);
    case "whisper": return `<Say>${xml(render(String(cfg.whisper ?? ""), vars))}</Say>`;
    case "gather":
    case "noinput": {
      const digits = (p.Digits ?? "").replace(/[^0-9*#]/g, "");
      const speech = (p.SpeechResult ?? "").slice(0, 300);
      vars.blocks[node.id] = { digits, speech };
      const chosen = ev === "gather" ? matchOption((cfg.options as Parameters<typeof matchOption>[0]) ?? [], digits, speech) : null;
      if (chosen) return go(chosen, { digits, speech });
      if (ev === "gather" && cfg.extensions && /^[0-9]{2,6}$/.test(digits)) {
        const { data: e } = await ctx.db.from("redial_extensions").select("id, name").eq("line_id", ctx.line.id).eq("ext", digits).maybeSingle();
        if (e) {
          await logStep(ctx, node, "extension", { digits, extension: e.name });
          const ghost: FlowNode = { ...node, type: "connect", config: { targets: [{ extensionId: e.id }], mode: "one", ringSeconds: 20 }, next: {} };
          return dialTargets(ctx, ghost, 0, `&ext=${e.id}`);
        }
      }
      const out = ev === "noinput" ? "noInput" : "noMatch";
      const sorry = ev === "noinput" ? "<Say>Sorry, I didn't get that.</Say>" : "<Say>Sorry, that's not one of the choices.</Say>";
      if (node.next[out] === node.id) { await logStep(ctx, node, out, { digits, speech }); return `${sorry}${await enter(ctx, node)}`; }
      if (node.next[out]) return go(out, { digits, speech });
      // Nothing connected: ask again, then fall back.
      const tries = (vars.tries ??= {});
      tries[node.id] = (tries[node.id] ?? 0) + 1;
      await logStep(ctx, node, out, { digits, speech, retry: tries[node.id] });
      if (tries[node.id] <= MAX_TRIES) return `${sorry}${await enter(ctx, node)}`;
      return unconnected(ctx);
    }
    case "dial": {
      const status = p.DialCallStatus ?? "failed";
      if (status === "completed") {
        await ctx.db.from("redial_calls").update({ status: "forwarded", ended_at: new Date().toISOString() }).eq("id", ctx.run.call_id);
        await logStep(ctx, node, "connected", { seconds: Number(p.DialCallDuration ?? 0) || 0 });
        if (node.next.connected) return advance(ctx, node.next.connected);
        await complete(ctx);
        return "<Hangup/>";
      }
      const i = Number(extra.get("i") ?? 0) || 0;
      const cfgT = cfg as { mode?: string; targets?: unknown[] };
      if (node.type === "connect" && cfgT.mode === "order" && i + 1 < (cfgT.targets?.length ?? 0)) {
        await logStep(ctx, node, "next_target", { status });
        return dialTargets(ctx, node, i + 1);
      }
      await ctx.db.from("redial_calls").update({ status: "ringing" }).eq("id", ctx.run.call_id);
      // A dialed extension that didn't answer: its own voicemail greeting.
      const extId = extra.get("ext");
      if (extId) {
        const { data: e } = await ctx.db.from("redial_extensions").select("name, voicemail_audio_id, line_id").eq("id", extId).maybeSingle();
        await logStep(ctx, node, "extension_voicemail", { status, extension: e?.name });
        await complete(ctx);
        const greeting = e?.line_id === ctx.line.id && e.voicemail_audio_id ? await promptTwiml(ctx, { audioId: e.voicemail_audio_id }) : "";
        if (ctx.test) return testVoicemail(greeting);
        return greeting
          ? `${greeting}<Record maxLength="120" playBeep="true" trim="trim-silence" recordingStatusCallback="${xml(redialUrl("recording", ctx.run.call_id!))}" recordingStatusCallbackEvent="completed"/><Hangup/>`
          : voicemail(ctx.run.call_id!, `${e?.name ?? "They"} can't take your call right now. Please leave a message after the tone.`);
      }
      const out = status === "busy" ? "busy" : status === "no-answer" ? "noAnswer" : "failed";
      return go(out, { status });
    }
    case "record": {
      const seconds = Number(p.RecordingDuration ?? 0) || 0;
      return go(seconds > 1 ? "recorded" : "none", { seconds });
    }
    default:
      return unconnected(ctx);
  }
}

export const blockLabel = (n: FlowNode) => n.label || BLOCKS[n.type].label;
