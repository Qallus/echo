// The parts of running a call tree that don't touch the network or the
// database: business hours, split rules, {{ }} templates, and matching what
// the caller pressed or said. No "@/" imports, so `node --test` can load it.

export type Vars = {
  call: Record<string, string>;
  flow: Record<string, string>;
  blocks: Record<string, Record<string, unknown>>;
  line: Record<string, string>;
  tries?: Record<string, number>;
};

export const emptyVars = (call: Record<string, string>, line: Record<string, string>): Vars => ({ call, flow: {}, blocks: {}, line, tries: {} });

function lookup(vars: Vars, path: string): unknown {
  const scope: Record<string, unknown> = { trigger: { call: vars.call }, flow: { vars: vars.flow }, blocks: vars.blocks, line: vars.line };
  let cur: unknown = scope;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// "Hi {{ trigger.call.callerName }}" → "Hi Dana". Unknown values become "".
// Values are inserted as text; nothing is evaluated.
export function render(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]{1,120})\s*\}\}/g, (_, path: string) => {
    const v = lookup(vars, path);
    return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v).slice(0, 500) : String(v);
  });
}

export const valueOf = (variable: string, vars: Vars) => {
  const v = lookup(vars, variable.replace(/^\{\{\s*|\s*\}\}$/g, ""));
  return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
};

// Which output a Business hours block takes at `now`.
export function hoursOut(cfg: { tz: string; week: Partial<Record<string, [string, string]>>; holidays?: string[] }, now: Date): "open" | "closed" | "holiday" {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: cfg.tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]));
  } catch {
    return "closed";
  }
  if ((cfg.holidays ?? []).includes(`${parts.year}-${parts.month}-${parts.day}`)) return "holiday";
  const day = cfg.week[parts.weekday.toLowerCase().slice(0, 3)];
  if (!day) return "closed";
  const hm = `${parts.hour}:${parts.minute}`;
  return hm >= day[0] && hm < day[1] ? "open" : "closed";
}

type Rule = { out: string; variable: string; op: string; value: string };

// The first rule that matches, or "noMatch".
export function splitOut(rules: Rule[], vars: Vars): string {
  for (const r of rules) {
    const actual = valueOf(r.variable, vars);
    const expected = render(r.value, vars);
    const a = actual.toLowerCase();
    const e = expected.toLowerCase();
    let hit = false;
    switch (r.op) {
      case "equals": hit = a === e; break;
      case "contains": hit = e !== "" && a.includes(e); break;
      case "empty": hit = actual.trim() === ""; break;
      case "gt": hit = Number(actual) > Number(expected); break;
      case "lt": hit = Number(actual) < Number(expected); break;
      case "matches":
        try { hit = expected.length <= 200 && new RegExp(expected, "i").test(actual.slice(0, 1000)); } catch { hit = false; }
        break;
    }
    if (hit) return r.out;
  }
  return "noMatch";
}

type Option = { out: string; key?: string; speech?: string[] };

// What the caller chose in a menu: an option's output, or null.
export function matchOption(options: Option[], digits: string, speech: string): string | null {
  if (digits) {
    const o = options.find((x) => x.key === digits);
    if (o) return o.out;
  }
  const said = speech.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  if (said.trim()) {
    for (const o of options) {
      if ((o.speech ?? []).some((w) => w.trim() && new RegExp(`\\b${w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u").test(said))) return o.out;
    }
  }
  return null;
}
