// Agent tasks (supabase/migrations/20261124090000_agent_tasks.sql): types,
// repeat rules, presets, and the next run time in the organization's time
// zone. No imports: shared by the admin page, the server actions and the
// connector tools.

export const REPEATS = [
  { id: "once", label: "Once" }, { id: "daily", label: "Every day" }, { id: "weekdays", label: "Weekdays (Mon–Fri)" },
  { id: "weekly", label: "Every week" }, { id: "monthly", label: "Every month" },
] as const;
export type Repeat = (typeof REPEATS)[number]["id"];
export const isRepeat = (v: unknown): v is Repeat => REPEATS.some((r) => r.id === v);

export const TASK_STATUSES = [
  { id: "queued", label: "Waiting" }, { id: "claimed", label: "Working" }, { id: "done", label: "Done" },
  { id: "failed", label: "Failed" }, { id: "paused", label: "Paused" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];

export type AgentTask = {
  id: string; agent_id: string | null; title: string; instructions: string; area: string | null; repeat: Repeat; run_time: string | null;
  next_run_at: string; status: TaskStatus; claimed_by: string | null; claimed_at: string | null; last_result: string | null; last_links: string[];
  last_run_at: string | null; runs: number; created_by: string | null; created_at: string; updated_at: string;
};
export type AgentTaskRun = { id: string; task_id: string; agent_id: string | null; ok: boolean; result: string | null; links: string[]; started_at: string | null; finished_at: string };

// Ready-made tasks: pick one, fill the blanks, adjust the wording.
export const TASK_PRESETS: { id: string; label: string; area: string; repeat: Repeat; title: string; instructions: string }[] = [
  {
    id: "find", label: "Find businesses", area: "prospects", repeat: "weekdays", title: "Find 20 HVAC businesses in Chandler, AZ",
    instructions: "Use prospects_find_places to search \"HVAC in Chandler, AZ\" (one page is enough). Add the open businesses that have a phone and aren't on the list with prospects_add_places, tag them \"agent-found\". Report how many you added and the 3 most promising (website, rating) with why.",
  },
  {
    id: "web", label: "Web lead research", area: "research", repeat: "weekly", title: "Find 15 plumbing companies in Gilbert, AZ on the web",
    instructions: "Use leads_research with what \"plumbing companies\" and where \"Gilbert, AZ\". Add the ones with a phone that aren't on the list using prospects_add (tag them \"web-research\"). Report how many you added, and the 3 best fits with why.",
  },
  {
    id: "research", label: "Research top prospects", area: "prospects", repeat: "once", title: "Research the top 10 prospects",
    instructions: "List prospects with prospects_list (sort by score, not looked up first). For the top 10, check their website and reviews (web_search) and write 2-3 lines each: what they do, how they answer calls today, the best opening line for a Redial call. Report it as a short list.",
  },
  {
    id: "lookup", label: "Carrier lookups", area: "prospects", repeat: "weekly", title: "Look up carriers for new prospects",
    instructions: "Run prospects_lookup for prospects not looked up yet. It needs a person's approval: ask once with the cost, then report how many were RingCentral, Cox, Spectrum or mobile.",
  },
  {
    id: "leads", label: "Best prospects to leads", area: "prospects", repeat: "weekly", title: "Turn this week's best prospects into leads",
    instructions: "Find prospects scoring 70 or more that aren't in the CRM (prospects_list with min_score 70) and convert up to 10 with prospects_to_leads. Report who you converted and why.",
  },
  {
    id: "inbox", label: "Inbox triage", area: "comms", repeat: "weekdays", title: "Triage the inbox",
    instructions: "List new inbox messages (resource_list inbox_message, status new). Save real sales inquiries as leads with inbox_convert. Don't reply to anyone. Report each message in one line: who, what they want, what you did.",
  },
  {
    id: "posts", label: "Draft social posts", area: "social", repeat: "weekly", title: "Draft and schedule 3 posts for next week",
    instructions: "Write 3 short posts for Redial (AI call screening for small businesses and families, scam protection). Plain words, one idea each, end with a question, link to https://redial.si. Use social_accounts_list, then social_post_create for each, scheduled Tuesday, Wednesday and Thursday at 9:00 next week on LinkedIn and Facebook. Never publish now. Report the three texts and their times.",
  },
];

// The UTC offset (ms) of a time zone at an instant.
function offsetAt(t: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(t)).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}
// A wall-clock time in a time zone -> the instant.
function zoned(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetAt(guess, tz);
  return first - (offsetAt(first, tz) - offsetAt(guess, tz));
}
function localDate(t: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date(t)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

// When a task should next run: the first matching day (from today) at
// run_time in the time zone, after `after`. Weekly keeps the weekday and
// monthly the day of month of `base` (the task's last scheduled run).
// Null for one-off tasks.
export function nextRun(repeat: Repeat, runTime: string | null, tz: string, base: Date, after = new Date()): Date | null {
  if (repeat === "once") return null;
  const [hh, mm] = (runTime ?? "08:00").split(":").map(Number);
  const b = localDate(base.getTime(), tz);
  const today = localDate(after.getTime(), tz);
  for (let i = 0; i < 70; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const fits = repeat === "daily" || (repeat === "weekdays" && wd >= 1 && wd <= 5) || (repeat === "weekly" && wd === b.wd)
      || (repeat === "monthly" && d === Math.min(b.d, last));
    if (!fits) continue;
    const at = zoned(y, m, d, hh, mm, tz);
    if (at > after.getTime() + 60_000) return new Date(at);
  }
  return null;
}

// The first run of a new task: now for one-off tasks without a time, else
// the next matching time.
export function firstRun(repeat: Repeat, runTime: string | null, tz: string, now = new Date()): Date {
  if (repeat === "once") {
    if (!runTime) return now;
    const t = localDate(now.getTime(), tz);
    const [hh, mm] = runTime.split(":").map(Number);
    const at = zoned(t.y, t.m, t.d, hh, mm, tz);
    return new Date(at > now.getTime() ? at : at + 86_400_000);
  }
  return nextRun(repeat === "weekly" || repeat === "monthly" ? "daily" : repeat, runTime, tz, now, new Date(now.getTime() - 60_000)) ?? now;
}

export const repeatLabel = (t: Pick<AgentTask, "repeat" | "run_time">) =>
  `${REPEATS.find((r) => r.id === t.repeat)?.label ?? t.repeat}${t.repeat !== "once" && t.run_time ? ` at ${t.run_time}` : ""}`;
