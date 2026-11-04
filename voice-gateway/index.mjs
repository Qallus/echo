// Echo voice gateway: bridges a Redial call's audio (Twilio Media Streams,
// G.711 μ-law 8 kHz) to the xAI realtime voice agent, which takes it natively
// (audio/pcmu), so nothing is transcoded.
//
// Twilio <Connect><Stream url="wss://<this host>/twilio"> with a signed
// <Parameter name="token">. On "start" the gateway asks Echo for the call's
// session (POST /api/webhooks/redial/session, HMAC-signed); Echo checks the
// token and returns the instructions, voice, tools, time limit and xAI key.
// Tool calls and the transcript go back to /api/webhooks/redial/result, and
// each line of the transcript is also sent as it's spoken (the live view).
// Closing the stream hands the call back to Echo: on the direct path the
// caller's TwiML continues (<Redirect>); on a conference call the AI's own
// leg hangs up and Echo moves the caller on. Either way Echo rings the owner
// if the assistant asked to connect, or hangs up.
//
// Env: APP_URL (https://echo.redial.si), REDIAL_GATEWAY_SECRET (same value as
// Admin -> Settings -> Integrations -> Redial), PORT (8080), MAX_CALLS (20).

import http from "node:http";
import { createHmac } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT) || 8080;
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");
const SECRET = process.env.REDIAL_GATEWAY_SECRET || "";
const MAX_CALLS = Number(process.env.MAX_CALLS) || 20;
if (!APP_URL || !SECRET) { console.error("Set APP_URL and REDIAL_GATEWAY_SECRET."); process.exit(1); }

const log = (id, ...args) => console.log(new Date().toISOString(), `[${id ?? "-"}]`, ...args);

async function echo(path, body) {
  const json = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", SECRET).update(`${ts}.${json}`).digest("hex");
  const res = await fetch(`${APP_URL}/api/webhooks/redial/${path}`, {
    method: "POST", headers: { "content-type": "application/json", "x-redial-timestamp": ts, "x-redial-signature": sig }, body: json,
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Echo ${res.status}`);
  return data;
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, calls: active })); return; }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ server, path: "/twilio", maxPayload: 256 * 1024 });
let active = 0;

wss.on("connection", (tw) => {
  if (active >= MAX_CALLS) { tw.close(1013, "busy"); return; }
  active++;
  let callId = null, streamSid = null, session = null, xai = null, ready = false, finished = false;
  let ending = false, endAfterResponse = false, startedAt = 0;
  const transcript = [];
  const said = new Map(); // response id -> assistant text so far
  const timers = [];
  const toTwilio = (m) => { if (tw.readyState === WebSocket.OPEN) tw.send(JSON.stringify(m)); };
  const toXai = (m) => { if (xai?.readyState === WebSocket.OPEN) xai.send(JSON.stringify(m)); };
  const addTurn = (role, text) => {
    transcript.push({ role, text });
    if (callId) echo("result", { callId, turn: { role, text } }).catch((e) => log(callId, "turn failed:", e.message));
  };
  const report = (extra = {}) => callId && echo("result", { callId, transcript, ...extra }).catch((e) => log(callId, "result failed:", e.message));

  // Hand the call back to Echo after the last words have played.
  const hangUpSoon = () => {
    if (ending) return;
    ending = true;
    toTwilio({ event: "mark", streamSid, mark: { name: "bye" } });
    timers.push(setTimeout(finish, 8000));
  };
  async function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    await report(startedAt ? { aiSeconds: Math.round((Date.now() - startedAt) / 1000) } : {});
    try { xai?.close(); } catch {}
    try { tw.close(); } catch {}
  }

  timers.push(setTimeout(() => { if (!session) { log(callId, "no start event"); finish(); } }, 10000));

  tw.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.event === "start") {
      streamSid = msg.start?.streamSid;
      try {
        session = await echo("session", { token: msg.start?.customParameters?.token ?? "" });
      } catch (e) {
        log(null, "session refused:", e.message);
        return finish();
      }
      callId = session.callId;
      log(callId, "call started");
      openXai();
    } else if (msg.event === "media" && ready && msg.media?.track !== "outbound") {
      toXai({ type: "input_audio_buffer.append", audio: msg.media.payload });
    } else if (msg.event === "mark" && msg.mark?.name === "bye") {
      finish();
    } else if (msg.event === "stop") {
      finish();
    }
  });
  tw.on("close", () => { active--; finish(); });
  tw.on("error", (e) => log(callId, "twilio error:", e.message));

  function openXai() {
    xai = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(session.model)}`, { headers: { Authorization: `Bearer ${session.xaiKey}` } });
    const connectTimer = setTimeout(() => { if (!ready) { log(callId, "xAI didn't start in time"); finish(); } }, 10000);
    timers.push(connectTimer);
    xai.on("error", (e) => { log(callId, "xAI error:", e.message); finish(); });
    xai.on("close", (code) => { if (!finished) { log(callId, "xAI closed", code); finish(); } });
    xai.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      switch (m.type) {
        case "conversation.created":
          toXai({
            type: "session.update",
            session: {
              instructions: session.instructions, voice: session.voice, turn_detection: { type: "server_vad" }, tools: session.tools,
              audio: { input: { format: { type: "audio/pcmu" } }, output: { format: { type: "audio/pcmu" } } },
            },
          });
          break;
        case "session.updated":
          if (ready) break;
          ready = true;
          startedAt = Date.now();
          clearTimeout(connectTimer);
          toXai({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "(The call just connected. Greet the caller now.)" }] } });
          toXai({ type: "response.create" });
          // Time limit: ask for a wrap-up, then hang up regardless.
          timers.push(setTimeout(() => {
            toXai({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "(Time is up. Save the call details now, say a brief goodbye, and end the call.)" }] } });
            toXai({ type: "response.create" });
          }, session.maxSeconds * 1000));
          timers.push(setTimeout(hangUpSoon, (session.maxSeconds + 25) * 1000));
          break;
        case "response.output_audio.delta":
        case "response.audio.delta":
          if (m.delta && streamSid) toTwilio({ event: "media", streamSid, media: { payload: m.delta } });
          break;
        case "input_audio_buffer.speech_started":
          if (!ending) toTwilio({ event: "clear", streamSid });
          break;
        case "response.output_audio_transcript.delta":
          said.set(m.response_id, (said.get(m.response_id) ?? "") + (m.delta ?? ""));
          break;
        case "response.output_audio_transcript.done": {
          const text = (m.transcript ?? said.get(m.response_id) ?? "").trim();
          said.delete(m.response_id);
          if (text) addTurn("assistant", text);
          break;
        }
        case "conversation.item.input_audio_transcription.completed":
          if (m.transcript?.trim()) addTurn("caller", m.transcript.trim());
          break;
        case "response.output_item.done":
          if (m.item?.type === "function_call") onTool(m.item);
          break;
        case "response.done":
          if (endAfterResponse) hangUpSoon();
          break;
        case "error":
          log(callId, "xAI:", m.error?.message ?? JSON.stringify(m));
          break;
      }
    });
  }

  async function onTool(item) {
    let args = {};
    try { args = JSON.parse(item.arguments || "{}"); } catch {}
    log(callId, "tool", item.name);
    const reply = (output) => toXai({ type: "conversation.item.create", item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(output) } });
    if (item.name === "save_call_details") {
      await report({ details: args });
      reply({ saved: true });
      toXai({ type: "response.create" });
    } else if (item.name === "connect_to_owner") {
      await report({ connect: true });
      reply({ connecting: true });
      endAfterResponse = true;
      hangUpSoon();
    } else if (item.name === "end_call") {
      reply({ ok: true });
      endAfterResponse = true;
      hangUpSoon();
    } else {
      reply({ error: "Unknown tool." });
      toXai({ type: "response.create" });
    }
  }
});

server.listen(PORT, () => console.log(`Echo voice gateway on :${PORT} → ${APP_URL}`));
