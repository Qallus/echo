import { z } from "zod";

// Call Tree's flow format (docs/IVR/REDIAL_FLOW_STUDIO_PLAN.md §4 and §6):
// one JSON document per draft or published version. The studio, the publish
// step and the call runner all read flows through this file. No "@/" imports,
// so `node --test` can load it directly.

export const FLOW_SCHEMA = 1;
export const MAX_NODES = 200;

const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Block ids are lowercase letters, digits and underscores.");
const text = (max: number) => z.string().trim().max(max);
const uuid = z.string().uuid();
const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use a full number like +14805550142.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// Something the caller hears: a Recording Studio clip, or text read aloud.
const prompt = z.object({ audioId: uuid.optional(), text: text(1000).optional() })
  .refine((p) => p.audioId || p.text, "Add a recording or the words to say.");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const target = z.union([z.object({ directoryId: uuid }), z.object({ extensionId: uuid }), z.object({ number: e164 })]);

// Block settings, by type. `outs` lists the fixed transitions; gather, split
// and ai add one per option, rule or intent.
export const BLOCKS = {
  "trigger.call": { label: "Incoming call", icon: "phone-incoming", caller: false, outs: ["next"], config: z.object({}) },
  say: { label: "Say / play", icon: "volume-2", caller: true, outs: ["next"], config: z.object({ prompt, loop: z.number().int().min(1).max(5).default(1) }) },
  gather: {
    label: "Gather input", icon: "keyboard", caller: true, outs: ["noInput", "noMatch"],
    config: z.object({
      prompt,
      input: z.array(z.enum(["dtmf", "speech"])).min(1).default(["dtmf"]),
      timeout: z.number().int().min(1).max(30).default(5),
      extensions: z.boolean().default(false), // the caller can dial an extension at any time
      options: z.array(z.object({
        out: id,
        key: z.string().regex(/^[0-9*#]$/).optional(),
        speech: z.array(text(40).min(1)).max(10).optional(),
      })).max(12),
    }),
  },
  split: {
    label: "Split conditions", icon: "split", caller: false, outs: ["noMatch"],
    config: z.object({
      rules: z.array(z.object({
        out: id,
        variable: text(120).min(1),
        op: z.enum(["equals", "contains", "matches", "gt", "lt", "empty"]),
        value: text(200).default(""),
      })).min(1).max(20),
    }),
  },
  hours: {
    label: "Business hours", icon: "clock", caller: false, outs: ["open", "closed", "holiday"],
    config: z.object({
      tz: text(60).min(1),
      week: z.partialRecord(z.enum(DAYS), z.tuple([time, time])),
      holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).default([]),
    }),
  },
  connect: {
    label: "Connect to extension", icon: "phone-forwarded", caller: true, outs: ["connected", "noAnswer", "busy", "failed"],
    config: z.object({
      targets: z.array(target).min(1).max(10),
      mode: z.enum(["one", "all", "order"]).default("one"),
      ringSeconds: z.number().int().min(5).max(60).default(20),
      whisper: text(300).optional(),
      record: z.boolean().default(false),
    }),
  },
  ai: {
    label: "AI receptionist", icon: "sparkles", caller: true, outs: ["handoff", "hungUp", "error"],
    config: z.object({
      instructions: text(4000).default(""),
      intents: z.array(z.object({ out: id, label: text(60).min(1) })).max(10).default([]),
      maxMinutes: z.number().int().min(1).max(30).default(5),
    }),
  },
  human: { label: "Human assistant", icon: "headset", caller: true, outs: ["connected", "none"], config: z.object({ pool: z.array(uuid).max(10).default([]) }) },
  queue: {
    label: "Queue / wait", icon: "list-ordered", caller: true, outs: ["answered", "timedOut", "pressed"],
    config: z.object({ holdAudioId: uuid.optional(), announceEvery: z.number().int().min(0).max(300).default(60), maxWait: z.number().int().min(30).max(3600).default(600) }),
  },
  voicemail: {
    label: "Record voicemail", icon: "circle-dot", caller: true, outs: ["recorded", "none"],
    config: z.object({ prompt: prompt.optional(), maxSeconds: z.number().int().min(10).max(300).default(120), transcribe: z.boolean().default(true) }),
  },
  callback: { label: "Callback request", icon: "phone-outgoing", caller: true, outs: ["saved"], config: z.object({ prompt: prompt.optional() }) },
  flow: { label: "Run another flow", icon: "git-branch", caller: false, outs: [], config: z.object({ flowId: uuid }) },
  hangup: { label: "Hang up", icon: "phone-off", caller: true, outs: [], config: z.object({ prompt: prompt.optional() }) },
  set: {
    label: "Set variables", icon: "variable", caller: false, outs: ["next"],
    config: z.object({ vars: z.array(z.object({ key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/), value: text(500) })).min(1).max(20) }),
  },
  http: {
    label: "HTTP / webhook", icon: "webhook", caller: false, outs: ["success", "failed"],
    config: z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
      url: z.string().url().refine((u) => u.startsWith("https://"), "Use an https:// address."),
      headers: z.array(z.object({ name: text(60).min(1), value: text(500) })).max(10).default([]),
      body: text(8000).default(""),
    }),
  },
  crm_lookup: { label: "CRM lookup", icon: "contact", caller: false, outs: ["found", "notFound"], config: z.object({}) },
  crm_update: { label: "CRM update", icon: "user-pen", caller: false, outs: ["next"], config: z.object({ note: text(1000).default(""), tags: z.array(text(40)).max(10).default([]) }) },
  message: {
    label: "Send SMS / email", icon: "mail", caller: false, outs: ["sent", "failed"],
    config: z.object({ channel: z.enum(["sms", "email"]), to: text(200).min(1), body: text(1600).min(1), subject: text(200).optional() }),
  },
} as const;

export type BlockType = keyof typeof BLOCKS;
export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

const node = z.object({
  id,
  type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
  label: text(80).default(""),
  pos: z.tuple([z.number().finite(), z.number().finite()]).default([0, 0]),
  config: z.record(z.string(), z.unknown()).default({}),
  next: z.record(z.string(), id).default({}),
});

export const flowSchema = z.object({
  schema: z.literal(FLOW_SCHEMA),
  name: text(80).min(1),
  settings: z.object({
    timezone: text(60).default("America/Phoenix"),
    recording: z.enum(["off", "all", "after_connect"]).default("off"),
    consentPrompt: text(300).optional(),
    // Where an unconnected output goes: the AI receptionist when the line has
    // AI minutes, otherwise voicemail (decided by the runner).
    onUnconnected: z.enum(["ai_or_voicemail", "voicemail", "goodbye"]).default("ai_or_voicemail"),
  }).default({ timezone: "America/Phoenix", recording: "off", onUnconnected: "ai_or_voicemail" }),
  start: id,
  nodes: z.array(node).min(1).max(MAX_NODES),
});

export type Flow = z.infer<typeof flowSchema>;
export type FlowNode = Flow["nodes"][number];

// The transitions a node can have: the block's fixed ones plus one per
// option, rule or intent.
export function outputsOf(n: FlowNode): string[] {
  const fixed: readonly string[] = BLOCKS[n.type].outs;
  const c = n.config as { options?: { out: string }[]; rules?: { out: string }[]; intents?: { out: string }[] };
  const dynamic = n.type === "gather" ? c.options : n.type === "split" ? c.rules : n.type === "ai" ? c.intents : undefined;
  return [...(dynamic ?? []).map((d) => d.out), ...fixed];
}

export type Issue = { level: "error" | "warning"; node?: string; message: string };

// Checks a flow. Errors block publishing; warnings don't.
export function validateFlow(input: unknown): { flow: Flow | null; issues: Issue[] } {
  const parsed = flowSchema.safeParse(input);
  if (!parsed.success) {
    return { flow: null, issues: parsed.error.issues.slice(0, 20).map((i) => ({ level: "error" as const, message: `${i.path.join(".") || "flow"}: ${i.message}` })) };
  }
  const flow = parsed.data;
  const issues: Issue[] = [];
  const byId = new Map<string, FlowNode>();
  for (const n of flow.nodes) {
    if (byId.has(n.id)) issues.push({ level: "error", node: n.id, message: `Two blocks share the id "${n.id}".` });
    byId.set(n.id, n);
  }

  const start = byId.get(flow.start);
  if (!start) issues.push({ level: "error", message: "The flow has no starting block." });
  else if (start.type !== "trigger.call") issues.push({ level: "error", node: start.id, message: "The flow must start with an Incoming call block." });
  if (flow.nodes.filter((n) => n.type === "trigger.call").length > 1) issues.push({ level: "error", message: "A flow can have only one Incoming call block." });

  for (const n of flow.nodes) {
    const cfg = BLOCKS[n.type].config.safeParse(n.config);
    if (!cfg.success) {
      for (const i of cfg.error.issues.slice(0, 3)) issues.push({ level: "error", node: n.id, message: `${n.label || BLOCKS[n.type].label}: ${i.message}` });
      continue;
    }
    const outs = outputsOf({ ...n, config: cfg.data as Record<string, unknown> });
    if (new Set(outs).size !== outs.length) issues.push({ level: "error", node: n.id, message: `${n.label || BLOCKS[n.type].label}: two outputs have the same name.` });
    if (n.type === "gather") {
      const keys = (cfg.data as { options: { key?: string }[] }).options.map((o) => o.key).filter(Boolean);
      if (new Set(keys).size !== keys.length) issues.push({ level: "error", node: n.id, message: `${n.label || "Gather input"}: a key is used twice.` });
    }
    for (const [out, to] of Object.entries(n.next)) {
      if (!outs.includes(out)) issues.push({ level: "error", node: n.id, message: `${n.label || BLOCKS[n.type].label}: "${out}" isn't one of its outputs.` });
      else if (!byId.has(to)) issues.push({ level: "error", node: n.id, message: `${n.label || BLOCKS[n.type].label}: "${out}" goes to a block that doesn't exist.` });
      else if (to === flow.start) issues.push({ level: "error", node: n.id, message: `${n.label || BLOCKS[n.type].label}: can't go back to Incoming call.` });
    }
    for (const out of outs) {
      if (!n.next[out] && out !== "noMatch" && out !== "noInput") issues.push({ level: "warning", node: n.id, message: `${n.label || BLOCKS[n.type].label}: "${out}" isn't connected.` });
    }
  }

  // Unreachable blocks.
  if (start) {
    const seen = new Set<string>([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const cur = byId.get(queue.shift()!);
      for (const to of Object.values(cur?.next ?? {})) if (byId.has(to) && !seen.has(to)) { seen.add(to); queue.push(to); }
    }
    for (const n of flow.nodes) if (!seen.has(n.id)) issues.push({ level: "warning", node: n.id, message: `${n.label || BLOCKS[n.type].label} can't be reached.` });
  }

  // A loop made only of server-side blocks would never wait for the caller.
  const server = (n: FlowNode) => !BLOCKS[n.type].caller;
  const state = new Map<string, 1 | 2>();
  const visit = (nid: string, path: string[]): string[] | null => {
    state.set(nid, 1);
    const n = byId.get(nid)!;
    for (const to of Object.values(n.next)) {
      const t = byId.get(to);
      if (!t || !server(t)) continue;
      if (state.get(to) === 1) return [...path, to];
      if (!state.has(to)) { const found = visit(to, [...path, to]); if (found) return found; }
    }
    state.set(nid, 2);
    return null;
  };
  for (const n of flow.nodes) {
    if (!server(n) || state.has(n.id)) continue;
    const loop = visit(n.id, [n.id]);
    if (loop) { issues.push({ level: "error", node: n.id, message: `These blocks loop without ever waiting for the caller: ${loop.join(" → ")}.` }); break; }
  }

  return { flow, issues };
}

export const canPublish = (issues: Issue[]) => !issues.some((i) => i.level === "error");
