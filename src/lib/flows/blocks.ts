import { BLOCKS, FLOW_SCHEMA, type BlockType, type Flow, type FlowNode } from "./schema";

// The Call Tree block library: how blocks are grouped and described, the
// settings a new block starts with, and the starter flow for a new flow.

export const CATEGORIES: { title: string; types: BlockType[] }[] = [
  { title: "Call handling", types: ["say", "gather", "split", "hours", "connect", "ai", "human", "queue", "voicemail", "callback", "flow", "hangup"] },
  { title: "Data and integrations", types: ["set", "http", "crm_lookup", "crm_update", "message"] },
];

export const DESCRIPTIONS: Record<BlockType, string> = {
  "trigger.call": "Where every call starts",
  say: "Play a recording or read text",
  gather: "Keypad and speech menu",
  split: "Route on matching rules",
  hours: "Open, closed or holiday",
  connect: "Ring a person or number",
  ai: "Your AI assistant answers",
  human: "An on-demand assistant",
  queue: "Hold with music",
  voicemail: "Take a message",
  callback: "Save a callback request",
  flow: "Continue in another flow",
  hangup: "End the call",
  set: "Save values for later",
  http: "Call an outside service",
  crm_lookup: "Find the caller in the CRM",
  crm_update: "Add a note or tag",
  message: "Text or email someone",
};

export const DEFAULT_CONFIG: Record<BlockType, Record<string, unknown>> = {
  "trigger.call": {},
  say: { prompt: { text: "Thanks for calling." }, loop: 1 },
  gather: { prompt: { text: "For sales, press 1. For support, press 2." }, input: ["dtmf"], timeout: 5, extensions: false, options: [{ out: "pressed_1", key: "1" }, { out: "pressed_2", key: "2" }] },
  split: { rules: [{ out: "rule_1", variable: "trigger.call.from", op: "contains", value: "" }] },
  hours: { tz: "America/Phoenix", week: { mon: ["08:00", "17:00"], tue: ["08:00", "17:00"], wed: ["08:00", "17:00"], thu: ["08:00", "17:00"], fri: ["08:00", "17:00"] }, holidays: [] },
  connect: { targets: [], mode: "one", ringSeconds: 20, record: false },
  ai: { instructions: "", intents: [], maxMinutes: 5 },
  human: { pool: [] },
  queue: { announceEvery: 60, maxWait: 600 },
  voicemail: { maxSeconds: 120, transcribe: true },
  callback: {},
  flow: { flowId: "" },
  hangup: {},
  set: { vars: [{ key: "note", value: "" }] },
  http: { method: "POST", url: "https://", headers: [], body: "" },
  crm_lookup: {},
  crm_update: { note: "", tags: [] },
  message: { channel: "sms", to: "", body: "" },
};

// A fresh id for a new block of this type: say, say_2, say_3…
export function newNodeId(type: BlockType, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = type.replace(".", "_");
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}_${i}`)) return `${base}_${i}`;
}

export function newNode(type: BlockType, taken: Iterable<string>, pos: [number, number]): FlowNode {
  return { id: newNodeId(type, taken), type, label: BLOCKS[type].label, pos, config: structuredClone(DEFAULT_CONFIG[type]), next: {} };
}

// A new flow: the caller is greeted, then the call ends. Enough to edit from.
export function starterFlow(name: string): Flow {
  return {
    schema: FLOW_SCHEMA,
    name,
    settings: { timezone: "America/Phoenix", recording: "off", onUnconnected: "ai_or_voicemail" },
    start: "incoming",
    nodes: [
      { id: "incoming", type: "trigger.call", label: "Incoming call", pos: [0, 0], config: {}, next: { next: "greeting" } },
      { id: "greeting", type: "say", label: "Greeting", pos: [0, 180], config: { prompt: { text: `Thanks for calling ${name}.` }, loop: 1 }, next: { next: "goodbye" } },
      { id: "goodbye", type: "hangup", label: "Goodbye", pos: [0, 360], config: {}, next: {} },
    ],
  };
}
