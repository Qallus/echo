"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Ban, Check, KeyRound, MessageSquareText, Pause, PhoneCall, PhoneIncoming, Play, ShieldAlert, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

// The /protect hero: how Redial stops a grandparent scam, in seven steps, on
// Ruth's phone. Plays on its own (paused for people who prefer less motion);
// any step can be picked from the list.

export const STEPS = [
  { title: "A call comes in.", desc: "An unknown number calls Ruth. Redial answers first, so her phone stays quiet." },
  { title: "Redial picks up.", desc: "A calm assistant asks who's calling and why. Echo transcribes every word." },
  { title: "The story starts.", desc: "The caller says he's her grandson, in jail after a crash, and needs bail now. The voice may be an AI clone." },
  { title: "Redial tests it.", desc: "It asks for the family code word. The caller dodges, demands gift cards, and says not to tell Mom." },
  { title: "Redial checks the facts.", desc: "No code word. A call-back to Tyler's saved number finds him safe in class. The script matches a known scam." },
  { title: "The scam is stopped.", desc: "The call ends and the number is blocked. Ruth's phone never rang." },
  { title: "Family is told.", desc: "Karen gets a text with what happened, so she can check on her mom." },
];

const LINES = [
  { who: "Redial", text: "Hi, you've reached Ruth's line. Who's calling, and what's it about?" },
  { who: "Caller", text: "Grandma? It's Tyler. I crashed the car and got arrested. I need bail money now." },
  { who: "Redial", text: "I can help. What's your family code word?" },
  { who: "Caller", text: "No time! Just get $5,000 in gift cards. And don't tell Mom." },
];
const MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (fn: () => void) => { const m = window.matchMedia(MOTION); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };

// How many conversation lines show at each step.
const SHOWN = [0, 1, 2, 4, 4, 4, 4];

export function PlayByPlay() {
  const [step, setStep] = useState(0);
  // Plays on its own unless the visitor prefers less motion; Play/Pause overrides.
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION).matches, () => false);
  const [choice, setPlaying] = useState<boolean | null>(null);
  const playing = choice ?? !reduced;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), step === STEPS.length - 1 ? 5200 : 3400);
    return () => clearTimeout(t);
  }, [step, playing]);

  return (
    <div className="grid w-full max-w-[34rem] gap-6 sm:grid-cols-[17rem_1fr] lg:max-w-none">
      <Phone step={step} />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">The play by play</p>
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause the animation" : "Play the animation"}
            className="inline-flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground">
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
        </div>
        <ol className="space-y-1">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button type="button" onClick={() => { setStep(i); setPlaying(false); }} aria-current={i === step ? "step" : undefined}
                className={cn("flex w-full gap-3 rounded-xl px-3 py-2 text-left transition-colors", i === step ? "bg-muted" : "hover:bg-muted/50")}>
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                  i < step ? "border-foreground bg-foreground text-background" : i === step ? "border-foreground" : "text-muted-foreground")}>
                  {i < step ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", i !== step && "text-muted-foreground")}>{s.title}</span>
                  {i === step && <span className="mt-0.5 block text-sm text-muted-foreground">{s.desc}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Phone({ step }: { step: number }) {
  // Once Redial is checking, only the caller's last line stays, to make room.
  const lines = step >= 4 ? LINES.slice(3, 4) : LINES.slice(0, SHOWN[step]);
  return (
    <div role="img" aria-label={`Ruth's phone, step ${step + 1} of 7: ${STEPS[step].title} ${STEPS[step].desc}`}
      className="relative mx-auto h-[33rem] w-[17rem] shrink-0 rounded-[2.6rem] border-[6px] border-neutral-900 bg-neutral-950 p-2 shadow-2xl dark:border-neutral-700">
      <div className="absolute top-3 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
      <div className="flex h-full flex-col overflow-hidden rounded-[2.1rem] bg-background text-foreground">
        <div className="flex items-center justify-between px-5 pt-8 pb-2 text-[10px] text-muted-foreground"><span>9:41</span><span>{step < 6 ? "Ruth's home phone" : "Karen's phone"}</span></div>

        {step === 6 ? (
          <div className="flex flex-1 flex-col gap-3 bg-muted/40 p-4">
            <div className="rounded-2xl border bg-background p-3 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.15em] text-muted-foreground"><MessageSquareText className="size-3" /> REDIAL · now</p>
              <p className="mt-1.5 text-sm font-semibold">Redial stopped a scam call to Mom</p>
              <p className="mt-1 text-xs text-muted-foreground">Someone posing as Tyler asked for bail in gift cards. Tyler is safe. Number blocked.</p>
            </div>
            <p className="mt-auto text-center text-[11px] text-muted-foreground">Ruth never had to hear it.</p>
          </div>
        ) : (
          <>
            <div className="px-4 text-center">
              <p className="text-base font-semibold tabular-nums">(480) 555-0142</p>
              <p className="text-[11px] text-muted-foreground">Unknown caller · not in contacts</p>
              <p className={cn("mx-auto mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                step >= 5 ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}>
                {step >= 5 ? <><ShieldX className="size-3" /> Likely scam · call ended</> : step === 0 ? <><PhoneIncoming className="size-3" /> Redial is answering</> : <><PhoneCall className="size-3" /> Redial is on the call</>}
              </p>
            </div>
            <div className="mt-3 flex-1 space-y-2 overflow-hidden px-3">
              {step === 0 && <p className="px-2 pt-6 text-center text-xs text-muted-foreground">Ruth&apos;s phone stays quiet while Redial finds out who&apos;s calling.</p>}
              {lines.map((l, i) => (
                <div key={i} className={cn("max-w-[88%] rounded-2xl px-3 py-1.5 text-[11px] leading-snug motion-safe:animate-in motion-safe:fade-in",
                  l.who === "Redial" ? "bg-muted" : "ml-auto bg-foreground text-background")}>
                  <span className="block text-[9px] font-semibold opacity-60">{l.who}</span>{l.text}
                </div>
              ))}
              {step >= 4 && (
                <div className="space-y-1 pt-1">
                  {[
                    { icon: KeyRound, t: "No family code word", d: "Dodged the question twice." },
                    { icon: Check, t: "Call-back: Tyler is safe", d: "Answered his saved number from class." },
                    { icon: ShieldAlert, t: "Known scam script", d: "Bail, gift cards and secrecy." },
                  ].map(({ icon: Icon, t, d }) => (
                    <div key={t} className="flex items-start gap-2 rounded-xl border bg-background px-2.5 py-1.5 motion-safe:animate-in motion-safe:fade-in">
                      <Icon className="mt-0.5 size-3.5 shrink-0" />
                      <span><span className="block text-[11px] font-medium">{t}</span><span className="block text-[10px] text-muted-foreground">{d}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {step >= 5 && (
              <p className="m-3 flex items-center justify-center gap-1.5 rounded-xl bg-red-500/10 py-2 text-[11px] font-medium text-red-700 dark:text-red-300"><Ban className="size-3.5" /> Number blocked. Ruth&apos;s phone never rang.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
