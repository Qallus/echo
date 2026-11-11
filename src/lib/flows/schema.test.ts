import { test } from "node:test";
import assert from "node:assert/strict";
import { canPublish, outputsOf, validateFlow, type Flow } from "./schema.ts";

// Run with: npm test

const base = (): Flow => ({
  schema: 1,
  name: "Main business line",
  settings: { timezone: "America/Phoenix", recording: "off", onUnconnected: "ai_or_voicemail" },
  start: "incoming",
  nodes: [
    { id: "incoming", type: "trigger.call", label: "Incoming call", pos: [0, 0], config: {}, next: { next: "hours" } },
    { id: "hours", type: "hours", label: "Business hours", pos: [0, 100],
      config: { tz: "America/Phoenix", week: { mon: ["08:00", "17:00"] }, holidays: [] }, next: { open: "menu", closed: "vm", holiday: "vm" } },
    { id: "menu", type: "gather", label: "Main menu", pos: [0, 200],
      config: { prompt: { text: "For sales press 1." }, input: ["dtmf"], timeout: 5, extensions: true, options: [{ out: "k1", key: "1" }] },
      next: { k1: "sales", noInput: "vm" } },
    { id: "sales", type: "connect", label: "Sales", pos: [0, 300],
      config: { targets: [{ number: "+14805550142" }], mode: "one", ringSeconds: 20, record: false }, next: { noAnswer: "vm", busy: "vm", failed: "vm", connected: "bye" } },
    { id: "vm", type: "voicemail", label: "Voicemail", pos: [200, 300], config: { maxSeconds: 120, transcribe: true }, next: { recorded: "bye", none: "bye" } },
    { id: "bye", type: "hangup", label: "Goodbye", pos: [0, 400], config: {}, next: {} },
  ],
});

const errors = (f: unknown) => validateFlow(f).issues.filter((i) => i.level === "error").map((i) => i.message);

test("a complete flow has no errors or warnings", () => {
  const { flow, issues } = validateFlow(base());
  assert.ok(flow);
  assert.deepEqual(issues, []);
  assert.ok(canPublish(issues));
});

test("gather outputs include one per option plus noInput and noMatch", () => {
  const { flow } = validateFlow(base());
  assert.deepEqual(outputsOf(flow!.nodes[2]), ["k1", "noInput", "noMatch"]);
});

test("a transition to a missing block is an error", () => {
  const f = base();
  f.nodes[3].next.noAnswer = "nowhere";
  assert.match(errors(f).join(" "), /doesn't exist/);
});

test("an output the block doesn't have is an error", () => {
  const f = base();
  f.nodes[0].next.sideways = "hours";
  assert.match(errors(f).join(" "), /isn't one of its outputs/);
});

test("the flow must start at the Incoming call block", () => {
  const f = base();
  f.start = "menu";
  assert.match(errors(f).join(" "), /must start with an Incoming call/);
});

test("duplicate block ids are an error", () => {
  const f = base();
  f.nodes[5].id = "vm";
  assert.match(errors(f).join(" "), /share the id/);
});

test("a key used twice in one menu is an error", () => {
  const f = base();
  (f.nodes[2].config as { options: { out: string; key: string }[] }).options.push({ out: "k1b", key: "1" });
  assert.match(errors(f).join(" "), /key is used twice/);
});

test("unreachable blocks and unconnected outputs are warnings, not errors", () => {
  const f = base();
  f.nodes.push({ id: "orphan", type: "hangup", label: "Orphan", pos: [400, 0], config: {}, next: {} });
  delete f.nodes[4].next.none;
  const { issues } = validateFlow(f);
  assert.ok(canPublish(issues));
  assert.ok(issues.some((i) => i.level === "warning" && /can't be reached/.test(i.message)));
  assert.ok(issues.some((i) => i.level === "warning" && /"none" isn't connected/.test(i.message)));
});

test("a loop of server-side blocks is an error", () => {
  const f = base();
  f.nodes.push(
    { id: "set_a", type: "set", label: "A", pos: [0, 0], config: { vars: [{ key: "x", value: "1" }] }, next: { next: "set_b" } },
    { id: "set_b", type: "set", label: "B", pos: [0, 0], config: { vars: [{ key: "y", value: "2" }] }, next: { next: "set_a" } },
  );
  f.nodes[3].next.failed = "set_a";
  assert.match(errors(f).join(" "), /loop without ever waiting/);
});

test("a loop through a menu is fine (the caller is asked each time)", () => {
  const f = base();
  f.nodes[2].next.noMatch = "menu";
  assert.ok(canPublish(validateFlow(f).issues));
});

test("missing block settings are reported", () => {
  const f = base();
  f.nodes[3].config = { targets: [] };
  assert.match(errors(f).join(" "), /Sales:/);
});

test("say needs a recording or text", () => {
  const f = base();
  f.nodes.push({ id: "hello", type: "say", label: "Hello", pos: [0, 0], config: { prompt: {} }, next: { next: "bye" } });
  f.nodes[4].next.none = "hello";
  assert.match(errors(f).join(" "), /Add a recording or the words to say/);
});

test("webhooks must use https", () => {
  const f = base();
  f.nodes.push({ id: "hook", type: "http", label: "Hook", pos: [0, 0], config: { url: "http://example.com" }, next: { success: "bye", failed: "bye" } });
  f.nodes[4].next.none = "hook";
  assert.match(errors(f).join(" "), /https/);
});

test("junk input is rejected without throwing", () => {
  assert.equal(validateFlow({ nope: true }).flow, null);
  assert.equal(validateFlow(null).flow, null);
});

test("the sample call tree is valid apart from choosing who Sales and Support ring", async () => {
  const { sampleFlow, starterFlow } = await import("./blocks.ts");
  const errs = validateFlow(sampleFlow("Summit Roofing")).issues.filter((i) => i.level === "error");
  assert.deepEqual(errs.map((e) => e.node).sort(), ["sales", "support"]);
  assert.ok(errs.every((e) => /Choose who to ring/.test(e.message)));
  assert.deepEqual(validateFlow(starterFlow("Test")).issues, []);
});
