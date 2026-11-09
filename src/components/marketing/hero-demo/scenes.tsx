import {
  AudioLines, Briefcase, Check, CheckCircle2, ChevronRight, FileText, Flag, Folder, Lock, Mic, Pause, Play, Search, Send, Sparkles, Square,
  SquarePen, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClaudeLogo, DriveLogo, GmailLogo } from "./logos";

// Each scene is drawn from `t`, the milliseconds since it started, so the demo
// is deterministic. Elements that should be clicked carry data-cursor="name";
// the cursor in hero-demo.tsx moves to them. Layout switches on the device
// screen's width (container queries, @md), not the browser window's.

type SceneProps = { t: number };

const TITLE = "Launch plan review";
const PEOPLE = {
  sam: { name: "Sam Lee", initials: "SL", dot: "bg-sky-500", ring: "ring-sky-500" },
  priya: { name: "Priya Shah", initials: "PS", dot: "bg-amber-500", ring: "ring-amber-500" },
} as const;
type Who = keyof typeof PEOPLE;
const LINES: { who: Who; at: string; text: string }[] = [
  { who: "sam", at: "0:00", text: "Thanks for joining. Let's review the launch plan for the new recorder." },
  { who: "priya", at: "0:05", text: "The budget is approved, and design finishes the panel this week." },
  { who: "sam", at: "0:10", text: "Great. Then we ship on Friday and send the announcement on Monday." },
];
const ACTIONS = [
  { text: "Finish the panel design", who: "Priya", due: "This week" },
  { text: "Ship the recorder", who: "Sam", due: "Friday" },
  { text: "Send the announcement", who: "Sam", due: "Monday" },
];
const SUMMARY = "The team approved the budget and set the launch for Friday, with the announcement going out on Monday.";

export function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex h-full items-center justify-center p-4 @md:p-8", className)}>{children}</div>;
}

// Always rendered so its space is reserved: content appearing never shifts the
// layout (which would also leave the cursor pointing at the wrong spot).
export function In({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return <div className={cn(show ? "hero-in" : "invisible", className)}>{children}</div>;
}

// `text` typed out from `start`, `cps` characters a second.
export function typed(text: string, t: number, start: number, cps = 40) {
  return text.slice(0, Math.max(0, Math.floor(((t - start) / 1000) * cps)));
}

export function Caret({ on }: { on: boolean }) {
  return on ? <span className="ml-px inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-foreground align-baseline" /> : null;
}

export function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

// Slim rounded bars. Live: every bar bounces on its own rhythm (a voice).
// With `progress`: an audio player, the played part filled in.
export function Waveform({ bars = 28, progress = 0, live = false, light = false, className }: {
  bars?: number; progress?: number; live?: boolean; light?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex h-8 flex-1 items-end gap-[3px]", live ? "justify-center" : "justify-between", className)}>
      {Array.from({ length: bars }, (_, i) => {
        const played = i / bars < progress;
        return (
          <span
            key={i}
            className={cn(
              "w-full max-w-[4px] rounded-full",
              light ? (played ? "bg-white" : "bg-white/30") : live ? "bg-muted-foreground/40" : played ? "bg-foreground" : "bg-muted-foreground/30",
              live && "hero-bar",
            )}
            style={{
              height: `${28 + ((i * 37) % 72)}%`,
              animationDelay: live ? `${(i % 7) * 0.11}s` : undefined,
              animationDuration: live ? `${0.7 + (i % 5) * 0.13}s` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function Avatar({ who, speaking, className }: { who: Who; speaking?: boolean; className?: string }) {
  const p = PEOPLE[who];
  return (
    <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold ring-2 ring-background transition-shadow", speaking && p.ring, className)}>
      {p.initials}
      <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background", p.dot)} />
    </span>
  );
}

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full overflow-hidden rounded-2xl border bg-background shadow-xl", className)}>{children}</div>;
}

// 1. Recording in the browser: who's talking, a live voice, your notes as you
// type, and a flagged moment.
export function RecordScene({ t }: SceneProps) {
  const speaker: Who = Math.floor(t / 1400) % 2 === 0 ? "sam" : "priya";
  const note = "Budget approved, ship Friday";
  const flagged = t > 2900;
  return (
    <Stage>
      <Shell className="max-w-md">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <AudioLines className="size-4 shrink-0" />
          <span className="truncate text-sm font-medium">{TITLE}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            <span className="size-1.5 animate-pulse rounded-full bg-red-600" /> REC
          </span>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1"><Avatar who="sam" speaking={speaker === "sam"} /><Avatar who="priya" speaking={speaker === "priya"} /></div>
              <div className="text-xs">
                <p className="font-medium">{PEOPLE[speaker].name}</p>
                <p className="flex items-center gap-1 text-muted-foreground"><Mic className="size-3" /> speaking</p>
              </div>
            </div>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{clock(4 + t / 1000)}</span>
          </div>
          <div className="flex h-14 items-center rounded-xl bg-muted/50 px-5"><Waveform live bars={34} className="h-9" /></div>
          <div className="space-y-2 rounded-xl border p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><SquarePen className="size-3" /> Your notes</p>
            <p className="min-h-5 text-sm">{typed(note, t, 700, 20)}<Caret on={t > 700 && t < 2500} /></p>
            <div className="space-y-1 text-xs">
              <In show={t > 2300} className="flex gap-2"><span className="w-8 text-muted-foreground tabular-nums">0:06</span> Note pinned to the transcript</In>
              <In show={flagged} className="flex gap-2"><span className="w-8 text-muted-foreground tabular-nums">0:07</span><span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><Flag className="size-3 fill-current" /> Flagged: ship date</span></In>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t p-3">
          <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium"><Lock className="size-3" /> Personal</span>
          <span className="ml-auto flex size-9 items-center justify-center rounded-full border"><Pause className="size-4" /></span>
          <span className="flex size-9 items-center justify-center rounded-full bg-red-600 text-white"><Square className="size-3.5 fill-current" /></span>
          <span data-cursor="flag" className={cn("flex size-9 items-center justify-center rounded-full border transition-colors", flagged && "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400")}><Flag className="size-4" /></span>
        </div>
      </Shell>
    </Stage>
  );
}

// 2. The transcript: processing steps, then each line with its speaker.
export function TranscribeScene({ t }: SceneProps) {
  const steps = ["Uploading audio", "Transcribing", "Labelling speakers"];
  const step = Math.min(2, Math.floor(t / 500));
  const done = t > 1500;
  return (
    <Stage className="items-start @md:items-center">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
          <Search className="size-3.5" />
          <span>{done && t > 4300 ? <span className="text-foreground">Friday</span> : "Search the transcript"}</span>
          <span className="ml-auto">{done ? "2 speakers · 0:14" : `${steps[step]}…`}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground transition-[width] duration-100" style={{ width: `${Math.min(1, t / 1500) * 100}%` }} /></div>
        {LINES.map((l, i) => {
          const at = 1600 + i * 850;
          return (
            <In key={l.at} show={t > at} className="flex gap-3">
              <Avatar who={l.who} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">{PEOPLE[l.who].name}<span className="text-xs font-normal text-muted-foreground tabular-nums">{l.at}</span></div>
                <p className="text-sm leading-relaxed text-foreground/80">
                  {t > 4300 && l.text.includes("Friday")
                    ? <>{l.text.split("Friday")[0]}<mark className="rounded bg-amber-300/60 px-0.5 text-foreground">Friday</mark>{l.text.split("Friday")[1]}</>
                    : typed(l.text, t, at, 90)}
                </p>
              </div>
            </In>
          );
        })}
        <In show={t > 4300} className="flex flex-wrap gap-2 text-[11px]">
          {(["sam", "priya"] as const).map((w, i) => (
            <span key={w} className="flex items-center gap-1.5 rounded-full border px-2 py-0.5"><span className={cn("size-1.5 rounded-full", PEOPLE[w].dot)} />{PEOPLE[w].name} · {i ? "46%" : "54%"} talk time</span>
          ))}
        </In>
      </div>
    </Stage>
  );
}

// 3. Ask Claude: the answer streams in, then the action items with owners.
export function ClaudeScene({ t }: SceneProps) {
  const answering = t >= 900;
  const streaming = answering && t < 900 + (SUMMARY.length / 70) * 1000;
  return (
    <Stage className="items-start @md:items-center">
      <div className="w-full max-w-xl space-y-4 text-sm">
        <div className="ml-auto max-w-[85%] space-y-2 rounded-2xl rounded-br-sm bg-muted px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"><AudioLines className="size-3" /> {TITLE} · transcript</span>
          <p>Summarize this call and list the action items.</p>
        </div>
        <div className="flex gap-3">
          <ClaudeLogo className="mt-0.5 size-5 shrink-0" />
          <div className="relative min-w-0 flex-1 space-y-3">
            {!answering && (
              <div className="absolute top-2 left-0 flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="hero-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
            )}
            <p className="min-h-10 leading-relaxed">{typed(SUMMARY, t, 900, 70)}<Caret on={streaming} /></p>
            <ul className="space-y-1.5">
              {ACTIONS.map((a, i) => (
                <In key={a.text} show={t > 2800 + i * 450} className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
                  <span className="size-3.5 shrink-0 rounded border" />
                  <span className="min-w-0 flex-1 truncate">{a.text}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px]">{a.who}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{a.due}</span>
                </In>
              ))}
            </ul>
            <In show={t > 4400} className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> Ask a follow-up, or send this to the team</In>
          </div>
        </div>
      </div>
    </Stage>
  );
}

function EchoMark({ className }: { className?: string }) {
  return <span className={cn("flex items-center gap-1.5 font-semibold tracking-[0.2em]", className)}><AudioLines className="size-4" />ECHO</span>;
}

// 4. Email the summary: recipients fill in, the cursor presses Send.
export function EmailScene({ t }: SceneProps) {
  const sent = t > 3300;
  const to = ["Sam Lee", "Priya Shah", "Launch team"];
  return (
    <Stage>
      <div className="relative w-full max-w-md">
        <Shell className="text-sm">
          <div className="space-y-1.5 border-b px-4 py-3 text-xs text-muted-foreground">
            <div className="flex min-h-6 flex-wrap items-center gap-1.5">
              <span className="w-12">To</span>
              {to.map((n, i) => <In key={n} show={t > 300 + i * 450} className="rounded-full bg-muted px-2 py-0.5 text-foreground">{n}</In>)}
            </div>
            <div className="flex gap-2"><span className="w-12 shrink-0">Subject</span><span className="truncate text-foreground">Summary: {TITLE}</span></div>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-lg bg-foreground px-4 py-3 text-background"><EchoMark className="text-sm" /></div>
            <p className="font-medium">Here&apos;s what was decided</p>
            <p className="text-xs leading-relaxed text-foreground/80">{SUMMARY}</p>
            <ul className="space-y-1 text-xs text-foreground/80">{ACTIONS.map((a) => <li key={a.text} className="flex gap-2"><Check className="size-3.5 shrink-0" />{a.text} · {a.who}, {a.due}</li>)}</ul>
            <div className="flex items-center justify-between pt-1">
              <span className="rounded-md border px-3 py-1.5 text-xs font-medium">Open in Echo</span>
              <span data-cursor="send" className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", sent ? "bg-emerald-600 text-white" : "bg-foreground text-background")}>
                {sent ? <><Check className="size-3.5" /> Sent</> : <><Send className="size-3.5" /> Send</>}
              </span>
            </div>
          </div>
        </Shell>
        <In show={t > 3700} className="absolute inset-x-6 -bottom-5 flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs shadow-lg">
          <CheckCircle2 className="size-4 text-emerald-600" /> Sent to 3 people
          <span className="ml-auto text-muted-foreground">{t > 4200 ? "Opened by Priya" : "Delivered"}</span>
        </In>
      </div>
    </Stage>
  );
}

const CONNECTIONS = [
  { name: "Claude", desc: "Ask about any recording", logo: ClaudeLogo, at: 0 },
  { name: "Google Drive", desc: "Save reports and audio", logo: DriveLogo, at: 600 },
  { name: "Gmail", desc: "Send summaries", logo: GmailLogo, at: 1200 },
  { name: "PDF report", desc: "Branded, with audio", logo: ({ className }: { className?: string }) => <FileText className={cn(className, "text-red-600")} />, at: 1800 },
];

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-emerald-600" : "bg-muted-foreground/30")}>
      <span className={cn("size-4 rounded-full bg-white shadow transition-transform", on && "translate-x-4")} />
    </span>
  );
}

// 5. Connections, then an automation switched on.
export function ConnectScene({ t }: SceneProps) {
  return (
    <Stage>
      <div className="w-full max-w-xl space-y-3">
        <p className="text-sm font-medium">Connections</p>
        <div className="grid gap-2.5 @md:grid-cols-2">
          {CONNECTIONS.map(({ name, desc, logo: Logo, at }) => {
            const on = t > at + 400;
            return (
              <div key={name} className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm">
                <span className="flex size-9 items-center justify-center rounded-lg border"><Logo className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-muted-foreground">{desc}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors", on ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                  {on ? "Connected" : "Connect"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
          <Users className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">After every meeting</p>
            <p className="text-xs text-muted-foreground">Email the summary to everyone who attended</p>
          </div>
          <span data-cursor="auto"><Toggle on={t > 3200} /></span>
        </div>
      </div>
    </Stage>
  );
}

// 6. A branded PDF report with the audio built in.
export function PdfScene({ t }: SceneProps) {
  const playing = t > 1600;
  const progress = playing ? Math.min(1, (t - 1600) / 2600) : 0;
  return (
    <Stage className="bg-muted/40">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-sm bg-white/70 shadow ring-1 ring-black/5" />
        <div className="relative rounded-sm bg-white text-neutral-900 shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between bg-neutral-900 px-5 py-3 text-white">
            <EchoMark className="text-xs" />
            <span className="text-[10px] tracking-wide text-white/60">MEETING REPORT · 1 / 3</span>
          </div>
          <div className="space-y-3 p-5">
            <div>
              <p className="text-base font-semibold">{TITLE}</p>
              <p className="text-[11px] text-neutral-500">Oct 30, 2026 · 0:14 · Sam Lee, Priya Shah</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
              <span data-cursor="play" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
                {playing ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
              </span>
              <Waveform bars={36} progress={progress} />
              <span className="text-[11px] text-neutral-500 tabular-nums">{clock(progress * 14)}</span>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-wide text-neutral-500">SUMMARY</p>
              <p className="text-xs leading-relaxed text-neutral-700">{SUMMARY}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-wide text-neutral-500">ACTION ITEMS</p>
              {ACTIONS.map((a) => <p key={a.text} className="flex items-center gap-2 text-xs text-neutral-700"><span className="size-3 rounded-sm border border-neutral-400" />{a.text}<span className="ml-auto text-neutral-500">{a.who}</span></p>)}
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// 7. A shareable web report styled like a landing page. It scrolls from the hero
// down to the audio player (container units: never further than the content),
// then the cursor presses play.
export function WebReportScene({ t }: SceneProps) {
  const scrolled = t > 1300;
  const playing = t > 3300;
  const progress = playing ? Math.min(1, (t - 3300) / 2000) : 0;
  return (
    <Stage className="bg-muted/40">
      <div className="h-full w-full max-w-2xl overflow-hidden rounded-lg bg-white text-neutral-900 shadow-xl ring-1 ring-black/5" style={{ containerType: "size" }}>
        <div
          className="transition-transform duration-1000 ease-in-out"
          style={{ transform: scrolled ? "translateY(min(0px, calc(100cqh - 100%)))" : "none" }}
        >
          <nav className="flex items-center gap-4 border-b border-neutral-200 px-5 py-3 text-xs">
            <EchoMark className="text-xs" />
            <span className="ml-auto hidden gap-4 text-neutral-500 @md:flex"><span>Summary</span><span>Actions</span><span>Audio</span></span>
            <span className="ml-auto rounded-md bg-neutral-900 px-2.5 py-1 font-medium text-white @md:ml-0">Share</span>
          </nav>
          <header className="bg-[radial-gradient(120%_120%_at_0%_0%,#3f3f46_0%,#09090b_60%)] px-5 py-8 text-white @md:px-8">
            <p className="text-[10px] font-medium tracking-[0.2em] text-white/60">MEETING REPORT · OCT 30, 2026</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight @md:text-3xl">{TITLE}</h3>
            <p className="mt-2 max-w-md text-sm text-white/70">Budget approved. The recorder ships Friday and the announcement goes out Monday.</p>
            <div className="mt-4 flex -space-x-2"><Avatar who="sam" className="ring-neutral-900" /><Avatar who="priya" className="ring-neutral-900" /></div>
          </header>
          <section className="space-y-4 px-5 py-5 @md:px-8">
            <div className="grid grid-cols-3 gap-2">
              {[["2", "Speakers"], ["3", "Decisions"], ["3", "Action items"]].map(([n, l]) => (
                <div key={l} className="rounded-lg border border-neutral-200 px-3 py-2">
                  <div className="text-lg font-semibold">{n}</div>
                  <div className="text-[11px] text-neutral-500">{l}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 @md:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-neutral-500">KEY POINTS</p>
                {["Budget approved for launch", "Panel design wraps this week", "Friday ship date confirmed"].map((k) => (
                  <p key={k} className="flex gap-2 text-xs text-neutral-700"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-900" />{k}</p>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-neutral-500">ACTION ITEMS</p>
                {ACTIONS.map((a) => <p key={a.text} className="flex items-center gap-2 text-xs text-neutral-700"><span className="size-3 shrink-0 rounded-sm border border-neutral-400" />{a.text}</p>)}
              </div>
            </div>
          </section>
          <section className="px-5 pb-6 @md:px-8">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-500">LISTEN TO THE CALL</p>
            <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-3 text-white">
              <span data-cursor="report-play" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900">
                {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
              </span>
              <Waveform bars={40} progress={progress} light />
              <span className="text-[11px] text-white/60 tabular-nums">{clock(progress * 14)} / 0:14</span>
            </div>
          </section>
        </div>
      </div>
    </Stage>
  );
}

// 8. Save the report to a workspace.
export function SaveScene({ t }: SceneProps) {
  const chosen = t > 2000;
  const options = [
    { key: "personal", icon: Lock, name: "Personal", desc: "Only you" },
    { key: "business", icon: Briefcase, name: "Business", desc: "Shared with your team · 6 people" },
  ];
  return (
    <Stage>
      <Shell className="relative max-w-sm p-4">
        <p className="text-sm font-medium">Save report to</p>
        <div className="mt-2 mb-3 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs">
          <FileText className="size-4 shrink-0 text-red-600" />
          <span className="min-w-0 flex-1 truncate">{TITLE}.pdf</span>
          <span className="shrink-0 text-muted-foreground">with audio · 1.2 MB</span>
        </div>
        <div className="space-y-2">
          {options.map(({ key, icon: Icon, name, desc }) => {
            const active = chosen && key === "business";
            return (
              <div key={key} data-cursor={key} className={cn("flex items-center gap-3 rounded-lg border p-3 transition-colors", active && "border-foreground bg-muted")}>
                <Icon className="size-4" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <span className={cn("flex size-4 items-center justify-center rounded-full border", active && "border-foreground bg-foreground text-background")}>
                  {active && <Check className="size-3" />}
                </span>
              </div>
            );
          })}
        </div>
        <In show={chosen} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Folder className="size-3.5" /> Business <ChevronRight className="size-3" /> Reports <ChevronRight className="size-3" /> Launch
        </In>
        <In show={t > 2700} className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Saved. Your team can find it in Business.
        </In>
      </Shell>
    </Stage>
  );
}
