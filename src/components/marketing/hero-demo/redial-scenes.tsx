import {
  Bell, Bot, CalendarClock, Check, Gavel, Headphones, MessageSquare, MessageSquareLock, Mic, PhoneForwarded, PhoneIncoming, ShieldCheck, Sparkles, User,
} from "lucide-react";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";
import { In, Stage, Waveform } from "./scenes";
import type { DemoScene } from "./hero-demo";

// Redial's hero demo: a call comes in -> the assistant screens it -> live
// controls -> take over -> Mirror -> the summary. Same rules as scenes.tsx:
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

function IncomingScene({ t }: SceneProps) {
  return (
    <Stage>
      <Card className="max-w-sm">
        <div className="space-y-4 p-5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10"><PhoneIncoming className="size-5" /></span>
          <div>
            <p className="text-lg font-semibold">{NUMBER}</p>
            <p className="text-xs text-muted-foreground">Calling your Redial number · your phone stays quiet</p>
          </div>
          <In show={t > 900} className="flex items-center justify-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <ShieldCheck className="size-3.5" /> Unknown caller · your rules say screen it
          </In>
          <In show={t > 1900} className="space-y-2">
            <div className="flex items-center gap-2 text-left text-xs font-medium"><Bot className="size-3.5" /> Ava is answering</div>
            <Waveform live bars={24} />
          </In>
        </div>
      </Card>
    </Stage>
  );
}

function ScreenScene({ t }: SceneProps) {
  return (
    <Stage className="items-start sm:items-center">
      <div className="w-full max-w-lg space-y-2.5">
        <In show={t > 200}><Bubble who="ai">Hi, this is Ava, Jordan&apos;s assistant. Jordan can&apos;t pick up right now. Who&apos;s calling, and what&apos;s it about?</Bubble></In>
        <In show={t > 1300}><Bubble who="caller">Hi, it&apos;s Dana from Summit Roofing, about tomorrow&apos;s install.</Bubble></In>
        <In show={t > 2400}><Bubble who="ai">Thanks, Dana. Let me see if Jordan can take it now.</Bubble></In>
        <In show={t > 3000} className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground"><Bell className="size-3.5" /> Jordan gets a quiet alert: your assistant is screening a call</In>
      </div>
    </Stage>
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

export const REDIAL_SCENES: DemoScene[] = [
  { label: "Call comes in", ms: 3600, Scene: IncomingScene },
  { label: "AI screens", ms: 4200, Scene: ScreenScene },
  { label: "Guide live", ms: 4400, Scene: ControlsScene },
  { label: "Take over", ms: 4400, Scene: TakeOverScene, cursor: [{ at: 400, target: "takeover" }, { at: 1100, target: "takeover", click: true }] },
  { label: FEATURES.mirror.name, ms: 4800, Scene: MirrorScene, cursor: [{ at: 2900, target: "send" }, { at: 3400, target: "send", click: true }] },
  { label: "Summary", ms: 4200, Scene: SummaryScene },
];
