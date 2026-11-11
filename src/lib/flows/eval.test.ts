import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyVars, hoursOut, matchOption, render, splitOut } from "./eval.ts";

const vars = () => {
  const v = emptyVars({ from: "+14805550142", callerName: "Dana Ortiz", to: "+16025550100" }, { name: "Summit Roofing", number: "+16025550100" });
  v.flow.tier = "gold";
  v.blocks.lookup = { status: 200, body: { plan: "pro" } };
  return v;
};

test("templates fill in call, flow, block and line values", () => {
  assert.equal(render("Hi {{ trigger.call.callerName }}, thanks for calling {{line.name}}.", vars()), "Hi Dana Ortiz, thanks for calling Summit Roofing.");
  assert.equal(render("{{flow.vars.tier}} {{blocks.lookup.body.plan}} {{nope.x}}", vars()), "gold pro ");
});

test("templates never evaluate code", () => {
  assert.equal(render("{{ constructor.constructor }}", vars()), "");
});

const week = { mon: ["08:00", "17:00"] as [string, string], tue: ["08:00", "17:00"] as [string, string] };

test("business hours follow the block's time zone", () => {
  // Monday 2026-11-09 16:30 UTC is 09:30 in Phoenix (UTC-7).
  assert.equal(hoursOut({ tz: "America/Phoenix", week }, new Date("2026-11-09T16:30:00Z")), "open");
  // 01:00 UTC Tuesday is 18:00 Monday in Phoenix: closed.
  assert.equal(hoursOut({ tz: "America/Phoenix", week }, new Date("2026-11-10T01:00:00Z")), "closed");
  // Sunday is closed.
  assert.equal(hoursOut({ tz: "America/Phoenix", week }, new Date("2026-11-08T18:00:00Z")), "closed");
});

test("holidays win over open hours", () => {
  assert.equal(hoursOut({ tz: "America/Phoenix", week, holidays: ["2026-11-09"] }, new Date("2026-11-09T16:30:00Z")), "holiday");
});

test("a bad time zone counts as closed", () => {
  assert.equal(hoursOut({ tz: "Not/AZone", week }, new Date()), "closed");
});

test("split rules: first match wins, otherwise noMatch", () => {
  const rules = [
    { out: "local", variable: "trigger.call.from", op: "matches", value: "^\\+1480" },
    { out: "vip", variable: "flow.vars.tier", op: "equals", value: "GOLD" },
  ];
  assert.equal(splitOut(rules, vars()), "local");
  assert.equal(splitOut(rules.slice(1), vars()), "vip");
  assert.equal(splitOut([{ out: "x", variable: "trigger.call.city", op: "contains", value: "" }], vars()), "noMatch");
  assert.equal(splitOut([{ out: "anon", variable: "trigger.call.city", op: "empty", value: "" }], vars()), "anon");
  assert.equal(splitOut([{ out: "bad", variable: "trigger.call.from", op: "matches", value: "(" }], vars()), "noMatch");
});

test("menu choices match keys and spoken words", () => {
  const options = [{ out: "sales", key: "1", speech: ["sales", "buy"] }, { out: "support", key: "2", speech: ["support", "help"] }];
  assert.equal(matchOption(options, "2", ""), "support");
  assert.equal(matchOption(options, "", "I need some HELP please"), "support");
  assert.equal(matchOption(options, "", "salesforce"), null);
  assert.equal(matchOption(options, "9", ""), null);
});
