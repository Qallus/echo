import {
  AlarmClock, AudioLines, Bot, CalendarClock, Check, CheckCircle2, Gavel, Grid3x3, Headphones, MessageSquare, MessageSquareLock, Mic, MicOff, Phone,
  PhoneCall, PhoneForwarded, PhoneOff, Send, ShieldCheck, Sparkles, User, Volume2,
} from "lucide-react";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";
import { Caret, In, Waveform, clock, typed } from "./scenes";
import type { DemoScene } from "./hero-demo";

// Redial's hero demo, every step a full phone screen: an unknown number rings
// (the problem) -> Redial's agent answers and finds out who it is (the fix) ->
// you guide it privately -> you take over -> Mirror helps while you talk ->
// the summary, saved to Echo. Same rules as scenes.tsx: drawn from `t`, and
// data-cursor marks what the cursor clicks.

type SceneProps = { t: number };
const CALLER = "Dana Ortiz";
const COMPANY = "Summit Roofing";
const NUMBER = "(480) 555-0142";

function Bubble({ who, children }: { who: "ai" | "caller" | "you"; children: React.ReactNode }) {
  const label = who === "ai" ? "Ava · your agent" : who === "caller" ? CALLER : "You";
  return (
    <div className={cn("flex max-w-[88%] gap-2 rounded-2xl px-3 py-2 text-[13px] leading-snug", who === "caller" ? "ml-auto rounded-br-sm bg-primary/10" : who === "you" ? "rounded-bl-sm bg-emerald-500/10" : "rounded-bl-sm bg-muted")}>
      {who === "ai" ? <Bot className="mt-0.5 size-3.5 shrink-0" /> : <User className="mt-0.5 size-3.5 shrink-0" />}
      <span><span className="block text-[10px] font-medium text-muted-foreground">{label}</span>{children}</span>
    </div>
  );
}

// The problem: a real incoming-call screen from a number you don't know.
// Then Redial picks up for you and the ringing stops.
function UnknownCallScene({ t }: SceneProps) {
  const picked = t > 3300;
  const doubts = [{ at: 800, text: "Spam?" }, { at: 1300, text: "A new client?" }, { at: 1800, text: "Your kid's school?" }];
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
      <In show={t > 2300} className="mt-4 max-w-[17rem] text-[15px] leading-snug text-white/75">
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
    { at: 400, who: "ai", text: "Hi, this is Ava, Jordan's assistant. Who's calling, and what's it about?" },
    { at: 2300, who: "caller", text: "Hi, it's Dana from Summit Roofing, about tomorrow's install." },
    { at: 4200, who: "ai", text: "Thanks, Dana. Let me see if Jordan can take it now." },
  ];
  const speaking = (t > 400 && t < 2000) || (t > 4200 && t < 5200);
  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-muted/70 to-background px-5 pt-16">
      <div className="flex items-center justify-center gap-2 text-xs font-medium">
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        Redial is on the call · {clock(1 + t / 1000)}
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

      <In show={t > 5400} className="mt-4 rounded-xl border bg-background p-3.5 shadow-lg">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Caller identified</p>
        <p className="mt-1 font-semibold">{CALLER} · {COMPANY}</p>
        <p className="text-sm text-muted-foreground">About tomorrow&apos;s roof install</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><ShieldCheck className="size-3.5" /> Real business, not spam</p>
      </In>

      {/* Jordan's quiet heads-up. */}
      <div className={cn(
        "absolute inset-x-3 top-12 rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur transition-[transform,opacity] duration-500 ease-out",
        t > 6400 ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0",
      )}>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><PhoneCall className="size-3" /> REDIAL · now</p>
        <p className="mt-0.5 text-sm font-semibold">{CALLER}, {COMPANY}</p>
        <p className="text-[13px] text-muted-foreground">About tomorrow&apos;s install. Listen in, guide Ava, or take the call.</p>
      </div>
    </div>
  );
}

// The live-call screen in the Redial app: who's on the line, what's being
// said, and the controls.
function CallScreen({ status, you, seconds, children, footer }: {
  status: string; you?: boolean; seconds: number; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-muted/70 to-background px-5 pt-14 pb-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-800 dark:text-amber-300">DO</span>
        <div className="min-w-0 flex-1">
          <p className="leading-tight font-semibold">{CALLER}</p>
          <p className="text-xs text-muted-foreground">{COMPANY} · <span className="tabular-nums">{clock(seconds)}</span></p>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium", you && "border-emerald-500/40 text-emerald-800 dark:text-emerald-300")}>
          <span className={cn("size-1.5 animate-pulse rounded-full", you ? "bg-emerald-500" : "bg-foreground")} />{status}
        </span>
      </div>
      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2.5">{children}</div>
      {footer}
    </div>
  );
}

const AGENT_CONTROLS = [
  { key: "listen", icon: Headphones, label: FEATURES.insider.action },
  { key: "guide", icon: MessageSquareLock, label: FEATURES.audible.action },
  { key: "takeover", icon: Gavel, label: FEATURES.gavel.action },
  { key: "transfer", icon: PhoneForwarded, label: FEATURES.directory.action },
];

// While the agent talks: listen, guide, take over, transfer.
function AgentControls({ active }: { active?: string }) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      {AGENT_CONTROLS.map(({ key, icon: Icon, label }) => (
        <span key={key} className="flex flex-col items-center gap-1.5 text-center text-[11px] leading-tight">
          <span data-cursor={key} className={cn("flex size-14 items-center justify-center rounded-full transition-colors", active === key ? "bg-foreground text-background" : "bg-muted")}>
            <Icon className="size-5" />
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

// Once you're talking: an ordinary call.
function YourControls() {
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
      {[{ icon: MicOff, label: "Mute" }, { icon: Grid3x3, label: "Keypad" }, { icon: Volume2, label: "Speaker" }].map(({ icon: Icon, label }) => (
        <span key={label} className="flex flex-col items-center gap-1.5"><span className="flex size-14 items-center justify-center rounded-full bg-muted"><Icon className="size-5" /></span>{label}</span>
      ))}
      <span className="flex flex-col items-center gap-1.5"><span className="flex size-14 items-center justify-center rounded-full bg-red-500 text-white"><PhoneOff className="size-5" /></span>End</span>
    </div>
  );
}

// You guide the agent privately; the caller never hears it.
function GuideScene({ t }: SceneProps) {
  const open = t > 1700;
  const direction = "Ask what time the crew arrives, and for the gate code.";
  const sent = t > 4300;
  return (
    <CallScreen status="Ava is talking" seconds={18 + t / 1000} footer={<AgentControls active={open ? "guide" : undefined} />}>
      <Bubble who="ai">Jordan&apos;s just finishing a meeting. Can I help with the install?</Bubble>
      <In show={t > 600}><Bubble who="caller">Sure. I need to confirm when the crew should arrive.</Bubble></In>
      <In show={t > 5600}><Bubble who="ai">Happy to. What time works for the crew, and is there a gate code?</Bubble></In>
      <div className="mt-auto" />
      <In show={open} className="space-y-2 rounded-2xl border bg-background p-3 shadow-lg">
        <p className="flex items-center gap-1.5 text-xs font-medium"><MessageSquareLock className="size-3.5" /> Guide Ava privately <span className="font-normal text-muted-foreground">· Dana can&apos;t hear this</span></p>
        <div className="flex items-end gap-2">
          <p className="min-h-10 flex-1 rounded-lg bg-muted/60 px-2.5 py-2 text-[13px]">{typed(direction, t, 2000, 26)}<Caret on={t > 2000 && !sent} /></p>
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full transition-colors", sent ? "bg-emerald-600 text-white" : "bg-foreground text-background")}>
            {sent ? <Check className="size-4" /> : <Send className="size-4" />}
          </span>
        </div>
        <p className={cn("text-[11px]", t > 5000 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {t > 5000 ? "Delivered. Ava asks at the next pause." : sent ? "Waiting for a pause…" : "Ava follows it on the next turn"}
        </p>
      </In>
    </CallScreen>
  );
}

// You take the call. The agent drops off; the caller never hangs up.
function TakeOverScene({ t }: SceneProps) {
  const handing = t > 1200 && t < 2200;
  const yours = t >= 2200;
  return (
    <CallScreen status={yours ? "You're on the call" : handing ? "Handing over…" : "Ava is talking"} you={yours} seconds={41 + t / 1000}
      footer={yours ? <YourControls /> : <AgentControls active={handing ? "takeover" : undefined} />}>
      <Bubble who="caller">8am works, and the gate code is 4417.</Bubble>
      <Bubble who="ai">Perfect, thank you, Dana.</Bubble>
      <In show={yours} className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
        <Mic className="size-3.5 shrink-0" /> Ava left the call. Same call, Dana never hung up.
      </In>
      <In show={t > 2800}><Bubble who="you">Hi Dana, it&apos;s Jordan. 8am is perfect, thanks for the code.</Bubble></In>
      <In show={t > 4500}><Bubble who="caller">Great, the crew will see you tomorrow!</Bubble></In>
      <div className="mt-auto flex w-40 self-center"><Waveform live bars={20} /></div>
    </CallScreen>
  );
}

// You're talking; Mirror listens silently and hands you what you need.
function MirrorScene({ t }: SceneProps) {
  const textSent = t > 5000;
  return (
    <CallScreen status="You're on the call" you seconds={68 + t / 1000} footer={<YourControls />}>
      <Bubble who="caller">Oh, and do your installs come with a warranty?</Bubble>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="size-3.5" /> {FEATURES.mirror.name} is listening · Dana can&apos;t hear it</p>
      <In show={t > 900} className="rounded-xl border bg-background p-2.5 text-[13px] shadow-sm">
        <p className="font-medium">Warranty answer</p>
        <p className="text-muted-foreground">Installs carry a 10-year workmanship warranty.</p>
        <span className="mt-1 inline-block rounded-full border px-1.5 text-[10px] text-muted-foreground">Your notes</span>
      </In>
      <In show={t > 2200} className="rounded-xl border bg-background p-2.5 text-[13px] shadow-sm">
        <p className="font-medium">From an earlier call</p>
        <p className="text-muted-foreground">Dana asked about gutter guards in March.</p>
        <span className="mt-1 inline-block rounded-full border px-1.5 text-[10px] text-muted-foreground">Call history</span>
      </In>
      <In show={t > 3400} className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-[13px]">
        <p className="flex items-center gap-1.5 font-medium"><MessageSquare className="size-3.5" /> Text Dana the prep checklist <span className="font-normal text-muted-foreground">· review first</span></p>
        <p className="text-muted-foreground">Hi Dana, for tomorrow: clear the driveway, pets inside, gate code 4417. Jordan</p>
        <span data-cursor="send" className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors", textSent ? "bg-emerald-600 text-white" : "bg-foreground text-background")}>
          {textSent ? <><Check className="size-3" /> Text sent</> : "Send text"}
        </span>
      </In>
    </CallScreen>
  );
}

// After the call: the summary, and everything saved to Echo.
function SummaryScene({ t }: SceneProps) {
  const items = ["Crew arrives at 8am", "Gate code 4417 (saved to the contact)", "Bring the warranty paperwork"];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-muted/70 to-background px-5 pt-14 pb-10">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-6" /></span>
        <p className="mt-2 text-lg font-semibold">Call ended · 3:12</p>
        <p className="text-xs text-muted-foreground">Screened by Ava, then taken over by you</p>
      </div>
      <div className="mt-5 space-y-3">
        <div className="rounded-xl border bg-background p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{CALLER}</p>
              <p className="text-xs text-muted-foreground">{COMPANY} · {NUMBER}</p>
            </div>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">Business</span>
          </div>
          <In show={t > 500} className="mt-2 text-[13px] leading-snug">Dana confirmed tomorrow&apos;s install. The crew arrives at 8am, the gate code is saved, and the prep checklist went out by text.</In>
        </div>
        <div className="space-y-1.5 rounded-xl border bg-background p-3.5 text-[13px] shadow-sm">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Action items</p>
          {items.map((a, i) => (
            <In key={a} show={t > 1300 + i * 450} className="flex items-center gap-2"><Check className="size-3.5 shrink-0 text-emerald-600" />{a}</In>
          ))}
        </div>
        <In show={t > 2900} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-xs shadow-sm">
          <CalendarClock className="size-4 shrink-0" /> Callback reminder: tomorrow, 5:00 PM
        </In>
        <In show={t > 3700} className="flex items-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-xs text-background">
          <AudioLines className="size-4 shrink-0" /> Recording, transcript and summary saved to Echo
        </In>
      </div>
    </div>
  );
}

// The timings above are written at Echo's pace; Redial's scenes carry more
// to read, so the whole demo plays this many times slower.
const SLOW = 1.5;

function slowed({ Scene, ms, cursor, ...rest }: DemoScene): DemoScene {
  return {
    ...rest,
    ms: ms * SLOW,
    Scene: function SlowScene({ t }: SceneProps) { return <Scene t={t / SLOW} />; },
    cursor: cursor?.map((c) => ({ ...c, at: c.at * SLOW })),
  };
}

export const REDIAL_SCENES: DemoScene[] = ([
  { label: "Unknown caller", ms: 5000, Scene: UnknownCallScene, screen: "dark" },
  { label: "Redial answers", ms: 7800, Scene: AgentAnswersScene, screen: "light" },
  { label: "Guide live", ms: 7400, Scene: GuideScene, screen: "light", cursor: [{ at: 1000, target: "guide" }, { at: 1600, target: "guide", click: true }] },
  { label: "Take over", ms: 6200, Scene: TakeOverScene, screen: "light", cursor: [{ at: 500, target: "takeover" }, { at: 1100, target: "takeover", click: true }] },
  { label: FEATURES.mirror.name, ms: 6400, Scene: MirrorScene, screen: "light", cursor: [{ at: 4100, target: "send" }, { at: 4800, target: "send", click: true }] },
  { label: "Summary", ms: 5400, Scene: SummaryScene, screen: "light" },
] satisfies DemoScene[]).map(slowed);
