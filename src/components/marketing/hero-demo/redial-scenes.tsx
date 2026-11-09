import {
  AlarmClock, Bot, CalendarClock, Check, Gavel, Headphones, MessageSquare, MessageSquareLock, Mic, Phone, PhoneCall, PhoneForwarded, PhoneOff,
  ShieldCheck, Sparkles, User,
} from "lucide-react";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";
import { In, Stage, Waveform } from "./scenes";
import type { DemoScene } from "./hero-demo";

// Redial's hero demo: an unknown number rings (the problem) -> Redial's agent
// answers and finds out who it is (the fix) -> live controls -> take over ->
// Mirror -> the summary. The first two fill the phone's whole screen. Same rules as scenes.tsx:
// drawn from `t`, and data-cursor marks what the cursor clicks.

type SceneProps = { t: number };
const CALLER = "Dana Ortiz";
const NUMBER = "(480) 555-0142";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full rounded-xl border bg-background shadow-lg", className)}>{children}</div>;
}

function Bubble({ who, children }: { who: "ai" | "caller" | "you"; children: React.ReactNode }) {
  const label = who === "ai" ? "Ava · your assistant" : who === "caller" ? CALLER : "You";
  return (
    <div className={cn("flex max-w-[88%] gap-2 rounded-lg px-3 py-2 text-[13px]", who === "caller" ? "ml-auto bg-primary/10" : who === "you" ? "bg-emerald-500/10" : "bg-muted")}>
      {who === "ai" ? <Bot className="mt-0.5 size-3.5 shrink-0" /> : <User className="mt-0.5 size-3.5 shrink-0" />}
      <span><span className="block text-[10px] font-medium text-muted-foreground">{label}</span>{children}</span>
    </div>
  );
}

// The problem: a real incoming-call screen from a number you don't know.
// Then Redial picks up for you and the ringing stops.
function UnknownCallScene({ t }: SceneProps) {
  const picked = t > 2900;
  const doubts = [{ at: 700, text: "Spam?" }, { at: 1100, text: "A new client?" }, { at: 1500, text: "Your kid's school?" }];
  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden bg-[radial-gradient(130%_75%_at_50%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] px-6 pt-20 text-center text-white">
      <p className="text-sm text-white/60">{picked ? "Redial is answering…" : "Incoming call"}</p>
      <p className="mt-1 text-[34px] leading-tight font-semibold">Unknown caller</p>
      <p className="text-lg text-white/85">{NUMBER}</p>
      <p className="mt-0.5 text-xs text-white/45">Phoenix, AZ · not in your contacts</p>

      <div className="relative mt-10 flex size-28 items-center justify-center">
        {!picked && <>
          <span className="absolute inset-0 animate-ping rounded-full bg-white/15" />
          <span className="absolute -inset-5 animate-ping rounded-full bg-white/[0.07] [animation-delay:0.4s]" />
        </>}
        <span className="relative flex size-28 items-center justify-center rounded-full bg-white/10 text-5xl font-light text-white/80 ring-1 ring-white/20">?</span>
      </div>

      <div className="mt-9 flex flex-wrap justify-center gap-2">
        {doubts.map((d) => (
          <In key={d.text} show={t > d.at} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/85 ring-1 ring-white/15">{d.text}</In>
        ))}
      </div>
      <In show={t > 2000} className="mt-4 max-w-[17rem] text-[15px] leading-snug text-white/75">
        Answer and risk spam. Ignore it and risk missing the call that matters.
      </In>

      {/* The phone's answer controls. */}
      <div className="absolute inset-x-0 bottom-14 px-10">
        <div className="mb-7 flex justify-between text-xs text-white/70">
          <span className="flex flex-col items-center gap-1.5"><AlarmClock className="size-5" />Remind me</span>
          <span className="flex flex-col items-center gap-1.5"><MessageSquare className="size-5" />Message</span>
        </div>
        <div className="flex justify-between text-xs text-white/80">
          <span className="flex flex-col items-center gap-2"><span className="flex size-[70px] items-center justify-center rounded-full bg-red-500"><PhoneOff className="size-7" /></span>Decline</span>
          <span className="flex flex-col items-center gap-2"><span className={cn("flex size-[70px] items-center justify-center rounded-full bg-emerald-500", !picked && "animate-bounce")}><Phone className="size-7" /></span>Accept</span>
        </div>
      </div>

      {/* The fix: Redial picks up instead. */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-background px-6 pt-6 pb-12 text-left text-foreground shadow-[0_-12px_40px_rgba(0,0,0,0.45)] transition-transform duration-700 ease-out",
        picked ? "translate-y-0" : "translate-y-full",
      )}>
        <div className="flex items-center gap-3">
          <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <span className="absolute inset-0 animate-ping rounded-full bg-foreground/30" />
            <PhoneCall className="relative size-5" />
          </span>
          <div>
            <p className="text-lg font-semibold">Redial picked up</p>
            <p className="text-sm text-muted-foreground">Your agent is answering. Your phone stops ringing.</p>
          </div>
        </div>
        <div className="mt-5 space-y-2.5 text-sm">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0" /> Unknown number: your rule says screen it</p>
          <p className="flex items-center gap-2"><Check className="size-4 shrink-0" /> You stay focused. No guessing.</p>
        </div>
      </div>
    </div>
  );
}

// The solution: your Redial agent is on the call, finds out who's calling and
// why, then tells you quietly.
function AgentAnswersScene({ t }: SceneProps) {
  const lines: { at: number; who: "ai" | "caller"; text: string }[] = [
    { at: 300, who: "ai", text: "Hi, this is Ava, Jordan's assistant. Who's calling, and what's it about?" },
    { at: 1500, who: "caller", text: "Hi, it's Dana from Summit Roofing, about tomorrow's install." },
    { at: 2700, who: "ai", text: "Thanks, Dana. Let me see if Jordan can take it now." },
  ];
  const speaking = (t > 300 && t < 1400) || (t > 2700 && t < 3500);
  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-muted/70 to-background px-5 pt-16">
      <div className="flex items-center justify-center gap-2 text-xs font-medium">
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        Redial is on the call · 0:{String(Math.floor(t / 1000) + 1).padStart(2, "0")}
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="relative flex size-24 items-center justify-center">
          {speaking && <span className="absolute inset-0 animate-ping rounded-full bg-foreground/15" />}
          <span className="relative flex size-24 items-center justify-center rounded-full bg-foreground text-background shadow-xl"><Bot className="size-10" /></span>
        </div>
        <p className="mt-3 text-xl font-semibold">Ava answered for you</p>
        <p className="text-sm text-muted-foreground">Your Redial agent · talking with {NUMBER}</p>
        <div className="mt-3 flex w-44"><Waveform live bars={22} /></div>
      </div>

      <div className="mt-5 space-y-2.5">
        {lines.map((l) => <In key={l.at} show={t > l.at}><Bubble who={l.who}>{l.text}</Bubble></In>)}
      </div>

      <In show={t > 3400} className="mt-4 rounded-xl border bg-background p-3.5 shadow-lg">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Caller identified</p>
        <p className="mt-1 font-semibold">Dana Ortiz · Summit Roofing</p>
        <p className="text-sm text-muted-foreground">About tomorrow&apos;s roof install</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><ShieldCheck className="size-3.5" /> Real business, not spam</p>
      </In>

      {/* Jordan's quiet heads-up. */}
      <div className={cn(
        "absolute inset-x-3 top-12 rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur transition-[transform,opacity] duration-500 ease-out",
        t > 4300 ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0",
      )}>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><PhoneCall className="size-3" /> REDIAL · now</p>
        <p className="mt-0.5 text-sm font-semibold">Dana Ortiz, Summit Roofing</p>
        <p className="text-[13px] text-muted-foreground">About tomorrow&apos;s install. Listen in, guide Ava, or take the call.</p>
      </div>
    </div>
  );
}

function ControlsScene({ t }: SceneProps) {
  const delivered = t > 2600;
  return (
    <Stage>
      <Card className="max-w-md">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-semibold">Live: {CALLER}</span>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">0:{String(18 + Math.floor(t / 1000)).padStart(2, "0")}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="flex items-center gap-1 rounded-md border px-2 py-1"><Headphones className="size-3" /> {FEATURES.insider.action}</span>
            <span className="flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-background"><Gavel className="size-3" /> {FEATURES.gavel.action}</span>
            <span className="flex items-center gap-1 rounded-md border px-2 py-1"><PhoneForwarded className="size-3" /> {FEATURES.directory.action}</span>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium"><MessageSquareLock className="size-3.5" /> Guide Ava privately <span className="font-normal text-muted-foreground">· Dana can&apos;t hear this</span></p>
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span>Ask what time the crew should arrive.</span>
              <In show={t > 900} className={cn("flex shrink-0 items-center gap-1 text-[11px]", delivered ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                {delivered ? <><Check className="size-3" /> Delivered to Ava</> : "Waiting for a pause"}
              </In>
            </div>
          </div>
          <In show={t > 3000}><Bubble who="ai">One more thing, Dana: what time should the crew arrive?</Bubble></In>
        </div>
      </Card>
    </Stage>
  );
}

function TakeOverScene({ t }: SceneProps) {
  const handing = t > 1300 && t < 2400;
  const speaking = t >= 2400;
  return (
    <Stage>
      <Card className="max-w-md">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-semibold">Live: {CALLER}</span>
          <span className="ml-auto text-xs text-muted-foreground">{speaking ? "You took over" : "Ava is talking"}</span>
        </div>
        <div className="space-y-3 p-4">
          {!speaking ? (
            <div className="flex items-center gap-2">
              <span data-cursor="takeover" className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"><Gavel className="size-3.5" /> {FEATURES.gavel.action}</span>
              <span className="text-xs text-muted-foreground">{handing ? "Removing the assistant…" : "Same call. Dana never hangs up."}</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-300"><Mic className="size-3.5" /> You&apos;re speaking with Dana</span>
              <span className="text-muted-foreground">Ava is off the call</span>
            </div>
          )}
          <In show={t > 2900}><Bubble who="you">Hi Dana, it&apos;s Jordan. Yes, 8am works for the crew.</Bubble></In>
        </div>
      </Card>
    </Stage>
  );
}

function MirrorScene({ t }: SceneProps) {
  return (
    <Stage>
      <Card className="max-w-md">
        <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs">
          <Sparkles className="size-3.5" /><span className="font-medium">{FEATURES.mirror.name}</span>
          <span className="text-muted-foreground">Listening silently. Dana can&apos;t hear it.</span>
        </div>
        <div className="space-y-2 p-4">
          <In show={t > 500} className="rounded-lg border p-2.5 text-[13px]">
            <p className="font-medium">Gate code for the driveway</p>
            <p className="text-muted-foreground">Ask Dana for it; last visit the crew waited 20 minutes.</p>
            <span className="mt-1 inline-block rounded-full border px-1.5 text-[10px] text-muted-foreground">Earlier call</span>
          </In>
          <In show={t > 1500} className="rounded-lg border p-2.5 text-[13px]">
            <p className="font-medium">Warranty answer</p>
            <p className="text-muted-foreground">Installs carry a 10-year workmanship warranty.</p>
            <span className="mt-1 inline-block rounded-full border px-1.5 text-[10px] text-muted-foreground">Your notes</span>
          </In>
          <In show={t > 2500} className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-[13px]">
            <p className="flex items-center gap-1.5 font-medium"><MessageSquare className="size-3.5" /> Text Dana the prep checklist <span className="font-normal text-muted-foreground">· review first</span></p>
            <p className="text-muted-foreground">Hi Dana, here&apos;s the checklist for tomorrow: clear the driveway, pets inside… Jordan</p>
            <span data-cursor="send" className="inline-block rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background">{t > 3600 ? "Text sent" : "Send text"}</span>
          </In>
        </div>
      </Card>
    </Stage>
  );
}

function SummaryScene({ t }: SceneProps) {
  return (
    <Stage>
      <Card className="max-w-md">
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{CALLER}</p>
              <p className="text-xs text-muted-foreground">{NUMBER} · Taken over from the assistant · 3 min</p>
            </div>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">Business</span>
          </div>
          <In show={t > 400} className="rounded-lg bg-muted/60 p-3 text-[13px]">Dana from Summit Roofing confirmed tomorrow&apos;s install. Crew arrives at 8am; gate code shared; prep checklist sent by text.</In>
          <In show={t > 1300} className="space-y-1 text-[13px]">
            <p className="text-xs font-medium text-muted-foreground">Action items</p>
            <p className="flex items-center gap-1.5"><Check className="size-3.5" /> Confirm the crew for 8am</p>
            <p className="flex items-center gap-1.5"><Check className="size-3.5" /> Bring the warranty paperwork</p>
          </In>
          <In show={t > 2200} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
            <CalendarClock className="size-3.5" /> Callback reminder: tomorrow, 5:00 PM
          </In>
        </div>
      </Card>
    </Stage>
  );
}

// The timings above are written at Echo's pace; Redial's scenes carry more
// to read, so the whole demo plays this many times slower.
const SLOW = 1.8;

function slowed({ Scene, ms, cursor, ...rest }: DemoScene): DemoScene {
  return {
    ...rest,
    ms: ms * SLOW,
    Scene: function SlowScene({ t }: SceneProps) { return <Scene t={t / SLOW} />; },
    cursor: cursor?.map((c) => ({ ...c, at: c.at * SLOW })),
  };
}

export const REDIAL_SCENES: DemoScene[] = ([
  { label: "Unknown caller", ms: 4400, Scene: UnknownCallScene, screen: "dark" },
  { label: "Redial answers", ms: 5600, Scene: AgentAnswersScene, screen: "light" },
  { label: "Guide live", ms: 4400, Scene: ControlsScene },
  { label: "Take over", ms: 4400, Scene: TakeOverScene, cursor: [{ at: 400, target: "takeover" }, { at: 1100, target: "takeover", click: true }] },
  { label: FEATURES.mirror.name, ms: 4800, Scene: MirrorScene, cursor: [{ at: 2900, target: "send" }, { at: 3400, target: "send", click: true }] },
  { label: "Summary", ms: 4200, Scene: SummaryScene },
] satisfies DemoScene[]).map(slowed);
