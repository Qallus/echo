import { BLOCKS, FLOW_SCHEMA, type BlockType, type Flow, type FlowNode } from "./schema.ts";

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
  flow: "Continue in another call tree",
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

// A worked example: business hours, a greeting and a phone menu (sales,
// support, operator, or dial an extension), with the AI assistant and
// voicemail behind it. Sales and Support still need someone to ring.
export function sampleFlow(name: string): Flow {
  const prompt = (text: string) => ({ text });
  return {
    schema: FLOW_SCHEMA,
    name,
    settings: { timezone: "America/Phoenix", recording: "off", onUnconnected: "ai_or_voicemail" },
    start: "incoming",
    nodes: [
      { id: "incoming", type: "trigger.call", label: "Incoming call", pos: [400, 0], config: {}, next: { next: "hours" } },
      { id: "hours", type: "hours", label: "Business hours", pos: [400, 170], config: DEFAULT_CONFIG.hours, next: { open: "greeting", closed: "after_hours", holiday: "after_hours" } },
      { id: "greeting", type: "say", label: "Greeting", pos: [160, 360], config: { prompt: prompt(`Thanks for calling ${name}.`), loop: 1 }, next: { next: "menu" } },
      {
        id: "menu", type: "gather", label: "Main menu", pos: [160, 540],
        config: {
          prompt: prompt("For sales, press 1. For support, press 2. To reach the operator, press 0. If you know your party's extension, dial it at any time."),
          input: ["dtmf", "speech"], timeout: 5, extensions: true,
          options: [{ out: "sales", key: "1", speech: ["sales"] }, { out: "support", key: "2", speech: ["support", "help"] }, { out: "operator", key: "0", speech: ["operator"] }],
        },
        next: { sales: "sales", support: "support", operator: "assistant", noInput: "assistant", noMatch: "menu" },
      },
      { id: "sales", type: "connect", label: "Sales", pos: [-160, 760], config: { targets: [], mode: "one", ringSeconds: 20, record: false }, next: { noAnswer: "voicemail", busy: "voicemail", failed: "voicemail" } },
      { id: "support", type: "connect", label: "Support", pos: [160, 760], config: { targets: [], mode: "all", ringSeconds: 25, record: false }, next: { noAnswer: "voicemail", busy: "voicemail", failed: "voicemail" } },
      { id: "assistant", type: "ai", label: "AI assistant", pos: [480, 760], config: { instructions: "Answer questions about the business, take a message, and offer a callback.", intents: [], maxMinutes: 5 }, next: { handoff: "voicemail", hungUp: "goodbye", error: "voicemail" } },
      { id: "after_hours", type: "say", label: "After hours", pos: [700, 360], config: { prompt: prompt("We're closed right now. Our hours are 8 to 5, Monday through Friday."), loop: 1 }, next: { next: "voicemail" } },
      { id: "voicemail", type: "voicemail", label: "Voicemail", pos: [160, 980], config: { prompt: prompt("Please leave your name, number and a short message after the tone."), maxSeconds: 120, transcribe: true }, next: { recorded: "goodbye", none: "goodbye" } },
      { id: "goodbye", type: "hangup", label: "Goodbye", pos: [160, 1180], config: { prompt: prompt("Thanks for calling. Goodbye.") }, next: {} },
    ],
  };
}

// Blocks are laid out in rows by depth from Incoming call (used by Build with
// AI and the Tidy up button). When most of the
// tree is new, everything is laid out fresh; otherwise existing blocks stay
// where they are and new ones go below them.
export function layoutFlow(next: Flow, current: Flow | null = null): Flow {
  const old = new Map((current?.nodes ?? []).map((n) => [n.id, n.pos]));
  const kept = next.nodes.filter((n) => old.has(n.id)).length;
  const fresh = kept * 2 < next.nodes.length;
  const depth = new Map<string, number>([[next.start, 0]]);
  const queue = [next.start];
  while (queue.length) {
    const id = queue.shift()!;
    const n = next.nodes.find((x) => x.id === id);
    for (const to of Object.values(n?.next ?? {})) if (!depth.has(to)) { depth.set(to, depth.get(id)! + 1); queue.push(to); }
  }
  const top = fresh ? 0 : Math.max(0, ...next.nodes.filter((n) => old.has(n.id)).map((n) => old.get(n.id)![1])) + 220;
  const perRow = new Map<number, number>();
  const rowSize = new Map<number, number>();
  for (const n of next.nodes) if (fresh || !old.has(n.id)) { const d = depth.get(n.id) ?? 99; rowSize.set(d, (rowSize.get(d) ?? 0) + 1); }
  const rows = [...rowSize.keys()].sort((x, y) => x - y);
  return {
    ...next,
    nodes: next.nodes.map((n) => {
      if (!fresh && old.has(n.id)) return { ...n, pos: old.get(n.id)! };
      const d = depth.get(n.id) ?? 99;
      const i = perRow.get(d) ?? 0;
      perRow.set(d, i + 1);
      const width = rowSize.get(d) ?? 1;
      return { ...n, pos: [Math.round((i - (width - 1) / 2) * 320), top + rows.indexOf(d) * 200] as [number, number] };
    }),
  };
}
