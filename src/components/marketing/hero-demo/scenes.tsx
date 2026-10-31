import {
  AudioLines, Briefcase, Check, CheckCircle2, FileText, Flag, Lock, Pause, Play, Send, Square, SquarePen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClaudeLogo, DriveLogo, GmailLogo } from "./logos";

// Each scene is drawn from `t`, the milliseconds since it started, so the demo
// is deterministic. Elements that should be clicked carry data-cursor="name";
// the cursor in hero-demo.tsx moves to them.

type SceneProps = { t: number };

const TITLE = "Launch plan review";
const LINES = [
  { who: "Speaker A", at: "0:00", text: "Thanks for joining. Let's review the launch plan for the new recorder." },
  { who: "Speaker B", at: "0:05", text: "The budget is approved, and design finishes the panel this week." },
  { who: "Speaker A", at: "0:10", text: "Great. Then we ship on Friday and send the announcement on Monday." },
];
const ACTIONS = ["Design finishes the panel (this week)", "Ship the recorder on Friday", "Send the announcement on Monday"];

function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex h-full items-center justify-center p-4 sm:p-8", className)}>{children}</div>;
}

// Always rendered so its space is reserved: content appearing never shifts the
// layout (which would also leave the cursor pointing at the wrong spot).
function In({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return <div className={cn(show ? "hero-in" : "invisible", className)}>{children}</div>;
}

function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function Waveform({ bars = 28, progress = 0, live = false }: { bars?: number; progress?: number; live?: boolean }) {
  return (
    <div className="flex h-8 flex-1 items-end gap-[3px]">
      {Array.from({ length: bars }, (_, i) => {
        const h = 30 + ((i * 37) % 70);
        return (
          <span
            key={i}
            className={cn("w-full rounded-full", i / bars < progress ? "bg-foreground" : "bg-muted-foreground/30", live && "hero-bar")}
            style={{ height: `${h}%`, animationDelay: live ? `${(i % 7) * 0.11}s` : undefined }}
          />
        );
      })}
    </div>
  );
}

export function RecordScene({ t }: SceneProps) {
  return (
    <Stage>
      <div className="w-full max-w-sm rounded-xl border bg-background shadow-lg">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <AudioLines className="size-4" />
          <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"><Lock className="size-3" /> Personal</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-red-600"><span className="size-2 animate-pulse rounded-full bg-red-600" /> Recording</span>
        </div>
        <div className="space-y-3 p-4">
          <Waveform live />
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
            <SquarePen className="size-3.5" /> Jot down key points or ideas instantly
          </div>
          <div className="min-h-12 space-y-1.5 text-xs">
            <In show={t > 1100} className="flex gap-2"><span className="w-8 tabular-nums text-muted-foreground">0:06</span> Budget approved</In>
            <In show={t > 2200} className="flex gap-2"><span className="w-8 tabular-nums text-muted-foreground">0:11</span><span className="flex items-center gap-1 text-muted-foreground"><Flag className="size-3" /> Flagged moment</span></In>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t p-3">
          <span className="flex size-8 items-center justify-center rounded-md border"><Pause className="size-3.5" /></span>
          <span className="flex size-8 items-center justify-center rounded-md border"><Square className="size-3 fill-current" /></span>
          <span className="flex-1 text-center text-xs tabular-nums text-muted-foreground">{clock(4 + t / 1000)}</span>
          <span className="flex size-8 items-center justify-center rounded-md border"><Flag className="size-3.5" /></span>
        </div>
      </div>
    </Stage>
  );
}

export function TranscribeScene({ t }: SceneProps) {
  const progress = Math.min(1, t / 900);
  return (
    <Stage className="items-start sm:items-center">
      <div className="w-full max-w-2xl space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress < 1 ? "Transcribing…" : "Transcript ready · 2 speakers"}</span>
            <span className="tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground transition-[width] duration-100" style={{ width: `${progress * 100}%` }} /></div>
        </div>
        {LINES.map((l, i) => (
          <In key={l.at} show={t > 1000 + i * 650} className="grid grid-cols-[2.75rem_1fr] gap-3">
            <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">{l.at}</span>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className={cn("size-2 rounded-full", l.who === "Speaker A" ? "bg-sky-500" : "bg-amber-500")} />{l.who}
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">{l.text}</p>
            </div>
          </In>
        ))}
      </div>
    </Stage>
  );
}

export function ClaudeScene({ t }: SceneProps) {
  return (
    <Stage className="items-start sm:items-center">
      <div className="w-full max-w-xl space-y-3 text-sm">
        <div className="ml-auto max-w-[85%] space-y-2 rounded-2xl rounded-br-sm bg-muted px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"><AudioLines className="size-3" /> {TITLE} · transcript</span>
          <p>Summarize this call and list the action items.</p>
        </div>
        <div className="flex gap-3">
          <ClaudeLogo className="mt-0.5 size-5 shrink-0" />
          <div className="relative space-y-2">
            {t < 900 && (
              <div className="absolute top-2 left-0 flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="hero-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
            )}
            <In show={t >= 900}><p>The team approved the budget and set the launch for Friday, with the announcement on Monday.</p></In>
            <ul className="space-y-1.5">
              {ACTIONS.map((a, i) => (
                <In key={a} show={t > 1300 + i * 400} className="flex items-center gap-2 text-foreground/80"><span className="size-3.5 rounded border" /> {a}</In>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Stage>
  );
}

function EchoMark({ className }: { className?: string }) {
  return <span className={cn("flex items-center gap-1.5 font-semibold tracking-[0.2em]", className)}><AudioLines className="size-4" />ECHO</span>;
}

export function EmailScene({ t }: SceneProps) {
  const sent = t > 2300;
  return (
    <Stage>
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border bg-background text-sm shadow-lg">
        <div className="space-y-1 border-b px-4 py-3 text-xs text-muted-foreground">
          <div className="flex gap-2"><span className="w-12">To</span><span className="text-foreground">Launch team</span></div>
          <div className="flex gap-2"><span className="w-12">Subject</span><span className="text-foreground">Summary: {TITLE}</span></div>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-lg bg-foreground px-4 py-3 text-background"><EchoMark className="text-sm" /></div>
          <p className="font-medium">Here&apos;s what was decided</p>
          <ul className="space-y-1 text-xs text-foreground/80">{ACTIONS.map((a) => <li key={a} className="flex gap-2"><Check className="size-3.5 shrink-0" />{a}</li>)}</ul>
          <div className="flex items-center justify-between pt-1">
            <span className="rounded-md border px-3 py-1.5 text-xs font-medium">Open in Echo</span>
            <span data-cursor="send" className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", sent ? "bg-emerald-600 text-white" : "bg-foreground text-background")}>
              {sent ? <><Check className="size-3.5" /> Sent</> : <><Send className="size-3.5" /> Send</>}
            </span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

const CONNECTIONS = [
  { name: "Claude", desc: "Ask about any recording", logo: ClaudeLogo, at: 0 },
  { name: "Google Drive", desc: "Save reports and audio", logo: DriveLogo, at: 700 },
  { name: "Gmail", desc: "Send summaries", logo: GmailLogo, at: 1400 },
  { name: "PDF report", desc: "Branded, with audio", logo: ({ className }: { className?: string }) => <FileText className={cn(className, "text-red-600")} />, at: 2100 },
];

export function ConnectScene({ t }: SceneProps) {
  return (
    <Stage>
      <div className="w-full max-w-xl space-y-3">
        <p className="text-sm font-medium">Connections</p>
        <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
    </Stage>
  );
}

export function PdfScene({ t }: SceneProps) {
  const playing = t > 1600;
  const progress = playing ? Math.min(1, (t - 1600) / 2600) : 0;
  return (
    <Stage className="bg-muted/40">
      <div className="w-full max-w-md rounded-sm bg-white text-neutral-900 shadow-xl ring-1 ring-black/5">
        <div className="flex items-center justify-between bg-neutral-900 px-5 py-3 text-white">
          <EchoMark className="text-xs" />
          <span className="text-[10px] tracking-wide text-white/60">MEETING REPORT</span>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <p className="text-base font-semibold">{TITLE}</p>
            <p className="text-[11px] text-neutral-500">Oct 30, 2026 · 0:14 · 2 speakers · Personal</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
            <span data-cursor="play" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
              {playing ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
            </span>
            <Waveform bars={32} progress={progress} />
            <span className="text-[11px] tabular-nums text-neutral-500">{clock(progress * 14)}</span>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-wide text-neutral-500">SUMMARY</p>
            <p className="text-xs leading-relaxed text-neutral-700">Budget approved. Launch on Friday, announcement on Monday.</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-wide text-neutral-500">ACTION ITEMS</p>
            {ACTIONS.map((a) => <p key={a} className="flex items-center gap-2 text-xs text-neutral-700"><span className="size-3 rounded-sm border border-neutral-400" />{a}</p>)}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// A shareable web report styled like a landing page. It scrolls from the hero
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
            <span className="ml-auto hidden gap-4 text-neutral-500 sm:flex"><span>Summary</span><span>Actions</span><span>Audio</span></span>
            <span className="rounded-md bg-neutral-900 px-2.5 py-1 font-medium text-white">Share</span>
          </nav>
          <header className="bg-[radial-gradient(120%_120%_at_0%_0%,#3f3f46_0%,#09090b_60%)] px-5 py-8 text-white sm:px-8">
            <p className="text-[10px] font-medium tracking-[0.2em] text-white/60">MEETING REPORT · OCT 30, 2026</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{TITLE}</h3>
            <p className="mt-2 max-w-md text-sm text-white/70">Budget approved. The recorder ships Friday and the announcement goes out Monday.</p>
          </header>
          <section className="space-y-4 px-5 py-5 sm:px-8">
            <div className="grid grid-cols-3 gap-2">
              {[["2", "Speakers"], ["3", "Decisions"], ["3", "Action items"]].map(([n, l]) => (
                <div key={l} className="rounded-lg border border-neutral-200 px-3 py-2">
                  <div className="text-lg font-semibold">{n}</div>
                  <div className="text-[11px] text-neutral-500">{l}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-neutral-500">KEY POINTS</p>
                {["Budget approved for launch", "Panel design wraps this week", "Friday ship date confirmed"].map((k) => (
                  <p key={k} className="flex gap-2 text-xs text-neutral-700"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-900" />{k}</p>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-neutral-500">ACTION ITEMS</p>
                {ACTIONS.map((a) => <p key={a} className="flex items-center gap-2 text-xs text-neutral-700"><span className="size-3 shrink-0 rounded-sm border border-neutral-400" />{a}</p>)}
              </div>
            </div>
          </section>
          <section className="px-5 pb-6 sm:px-8">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-500">LISTEN TO THE CALL</p>
            <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-3 text-white">
              <span data-cursor="report-play" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900">
                {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
              </span>
              <div className="flex h-8 flex-1 items-end gap-[3px]">
                {Array.from({ length: 36 }, (_, i) => (
                  <span key={i} className={cn("w-full rounded-full", i / 36 < progress ? "bg-white" : "bg-white/25")} style={{ height: `${30 + ((i * 37) % 70)}%` }} />
                ))}
              </div>
              <span className="text-[11px] tabular-nums text-white/60">{clock(progress * 14)} / 0:14</span>
            </div>
          </section>
        </div>
      </div>
    </Stage>
  );
}

export function SaveScene({ t }: SceneProps) {
  const chosen = t > 2300;
  const options = [
    { key: "personal", icon: Lock, name: "Personal", desc: "Only you" },
    { key: "business", icon: Briefcase, name: "Business", desc: "Shared with your team" },
  ];
  return (
    <Stage>
      <div className="relative w-full max-w-sm rounded-xl border bg-background p-4 shadow-lg">
        <p className="text-sm font-medium">Save report to</p>
        <p className="mb-3 text-xs text-muted-foreground">{TITLE}.pdf with audio</p>
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
        <In show={t > 2700} className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Saved to Business · Reports
        </In>
      </div>
    </Stage>
  );
}
