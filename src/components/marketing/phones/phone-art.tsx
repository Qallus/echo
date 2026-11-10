"use client";

import { useEffect, useState } from "react";
import { AudioLines, Ban, PhoneIncoming, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

// Drawn phones for the phone service pages: a Wi-Fi cordless handset on its
// stand, and a desk phone. The screens step through a call DJ screens, a few
// seconds a frame (held on the first frame when the visitor prefers reduced
// motion). The body matches the hero's phone frame (neutral-900); the screen
// uses the design tokens, so it follows light and dark mode.

export type ScreenFrame = { tag: string; title: string; detail: string; action?: string; tone?: "call" | "dj" | "blocked" };

function useFrame(count: number, ms = 2800) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms]);
  return i;
}

function Screen({ frames, compact }: { frames: ScreenFrame[]; compact?: boolean }) {
  const f = frames[useFrame(frames.length)];
  const Icon = f.tone === "blocked" ? Ban : f.tone === "dj" ? AudioLines : PhoneIncoming;
  return (
    <div aria-live="off" className="flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-between px-2 pt-1 text-[8px] text-muted-foreground"><Wifi className="size-2.5" /><span>11:40</span></div>
      <div key={f.title} className="hero-in flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center">
        <span className={cn("flex size-6 items-center justify-center rounded-full", f.tone === "blocked" ? "bg-destructive/10 text-destructive" : "bg-muted")}>
          <Icon className={cn("size-3.5", f.tone === "dj" && "animate-pulse")} />
        </span>
        <p className="text-[8px] font-medium tracking-wide text-muted-foreground uppercase">{f.tag}</p>
        <p className={cn("leading-tight font-semibold", compact ? "text-[10px]" : "text-[11px]")}>{f.title}</p>
        <p className="text-[8px] leading-snug text-muted-foreground">{f.detail}</p>
      </div>
      <div className="grid grid-cols-3 border-t px-1 py-0.5 text-center text-[7px] text-muted-foreground">
        <span>{f.action ? "Answer" : "Menu"}</span><span>{f.action ?? "Redial"}</span><span>{f.action ? "Decline" : "History"}</span>
      </div>
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// A Wi-Fi cordless handset in its charging stand.
export function CordlessPhone({ frames, className }: { frames: ScreenFrame[]; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-44", className)} role="img" aria-label="A Wi-Fi cordless phone showing DJ screening a call">
      <div className="relative z-10 mx-auto w-36 rounded-[1.75rem] bg-neutral-900 p-2.5 shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/15">
        <div className="mb-2 flex items-center justify-between px-3"><span className="size-1 rounded-full bg-emerald-400" /><span className="h-1 w-6 rounded-full bg-neutral-700" /><span className="size-1.5 rounded-full bg-neutral-700" /></div>
        <div className="h-36 overflow-hidden rounded-md bg-neutral-950 p-0.5"><div className="h-full overflow-hidden rounded-sm"><Screen frames={frames} compact /></div></div>
        <p className="mt-1.5 text-center text-[6px] font-semibold tracking-[0.3em] text-neutral-400">REDIAL</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1">{[0, 1, 2].map((k) => <span key={k} className="h-2 rounded-sm bg-neutral-700" />)}</div>
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="h-3 w-5 rounded bg-neutral-800 ring-1 ring-emerald-500/60" />
          <span className="flex size-9 items-center justify-center rounded-full bg-neutral-800"><span className="size-4 rounded-full bg-neutral-700" /></span>
          <span className="h-3 w-5 rounded bg-neutral-800 ring-1 ring-rose-500/60" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {KEYS.map((k) => <span key={k} className="flex h-4 items-center justify-center rounded bg-neutral-800 text-[8px] font-medium text-neutral-300">{k}</span>)}
        </div>
        <div className="mt-2 h-2" />
      </div>
      <div className="relative -mt-10 h-16 rounded-t-[2rem] rounded-b-xl bg-neutral-800 shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/15" />
    </div>
  );
}

// A desk phone: corded handset on the left, screen and keypad on the right.
export function DeskPhone({ frames, className }: { frames: ScreenFrame[]; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-md", className)} role="img" aria-label="A desk phone showing DJ screening a call">
      <div className="flex gap-3 rounded-3xl bg-neutral-900 p-4 shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/15">
        <div className="flex w-20 shrink-0 flex-col justify-between rounded-2xl bg-neutral-950 p-2 ring-1 ring-white/5">
          <span className="text-[9px] font-bold text-neutral-400">HD</span>
          <span className="mx-auto h-24 w-2 rounded-full bg-white/5" />
          <span className="mx-auto h-1 w-8 rounded-full bg-white/10" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col justify-around gap-2">{[0, 1].map((k) => <span key={k} className="h-2 w-5 rounded-full bg-neutral-700"><span className="ml-auto block size-1.5 translate-x-0.5 rounded-full bg-emerald-400" /></span>)}</div>
            <div className="h-32 min-w-0 flex-1 overflow-hidden rounded-md bg-neutral-950 p-0.5"><div className="h-full overflow-hidden rounded-sm"><Screen frames={frames} /></div></div>
            <div className="flex flex-col justify-around gap-2">{[0, 1].map((k) => <span key={k} className="h-2 w-5 rounded-full bg-neutral-700" />)}</div>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
            <div className="grid grid-cols-3 gap-1.5">
              {KEYS.map((k) => <span key={k} className="flex h-5 items-center justify-center rounded bg-neutral-800 text-[9px] font-semibold text-neutral-300">{k}</span>)}
            </div>
            <div className="flex flex-col items-center justify-between">
              <span className="flex size-12 items-center justify-center rounded-full bg-neutral-800"><span className="size-5 rounded-full bg-neutral-700" /></span>
              <span className="h-2.5 w-14 rounded-full bg-neutral-800" />
              <span className="flex gap-1.5"><span className="h-4 w-6 rounded bg-neutral-800" /><span className="h-4 w-6 rounded bg-neutral-800" /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
