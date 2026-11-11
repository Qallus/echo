"use client";

import { useEffect, useState } from "react";
import { AudioLines, Ban, PhoneIncoming, Wifi } from "lucide-react";
import { Named } from "@/components/marketing/agent-name";
import { cn } from "@/lib/utils";

// Drawn phones for the phone service pages: a Wi-Fi cordless handset on its
// stand and a desk phone. The screens step through a call the assistant screens, a few seconds a frame
// (held on the first frame when the visitor prefers reduced motion). Bodies
// match the hero's phone frame (neutral-900); screens use the design tokens,
// so they follow light and dark mode.

export type ScreenFrame = { tag: string; title: string; detail: string; action?: string; tone?: "call" | "dj" | "blocked" };

const BODY = "bg-neutral-900 shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/15";

function useFrame(count: number, ms = 3200) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms]);
  return i;
}

function Screen({ frames, size = "md" }: { frames: ScreenFrame[]; size?: "sm" | "md" }) {
  const f = frames[useFrame(frames.length)];
  const Icon = f.tone === "blocked" ? Ban : f.tone === "dj" ? AudioLines : PhoneIncoming;
  const sm = size === "sm";
  return (
    <div aria-live="off" className="flex h-full flex-col bg-background text-foreground">
      <div className={cn("flex items-center justify-between px-3 pt-1.5 text-muted-foreground", sm ? "text-[9px]" : "text-[11px]")}><Wifi className={sm ? "size-3" : "size-3.5"} /><span>11:40</span></div>
      <div key={f.title} className="hero-in flex flex-1 flex-col items-center justify-center gap-1.5 px-3 text-center">
        <span className={cn("flex items-center justify-center rounded-full", sm ? "size-8" : "size-10", f.tone === "blocked" ? "bg-destructive/10 text-destructive" : "bg-muted")}>
          <Icon className={cn(sm ? "size-4" : "size-5", f.tone === "dj" && "animate-pulse")} />
        </span>
        <p className={cn("font-medium tracking-wide text-muted-foreground uppercase", sm ? "text-[9px]" : "text-[11px]")}><Named text={f.tag} /></p>
        <p className={cn("leading-tight font-semibold", sm ? "text-[13px]" : "text-base")}><Named text={f.title} /></p>
        <p className={cn("leading-snug text-muted-foreground", sm ? "text-[10px]" : "text-xs")}><Named text={f.detail} /></p>
      </div>
      <div className={cn("grid grid-cols-3 border-t px-1 py-1 text-center text-muted-foreground", sm ? "text-[9px]" : "text-[10px]")}>
        <span>{f.action ? "Answer" : "Menu"}</span><span>{f.action ?? "Redial"}</span><span>{f.action ? "Decline" : "History"}</span>
      </div>
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// A Wi-Fi cordless handset in its charging stand.
export function CordlessPhone({ frames, className }: { frames: ScreenFrame[]; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-64 sm:w-72", className)} role="img" aria-label="A Wi-Fi cordless phone showing an AI assistant screening a call">
      <div className={cn("relative z-10 mx-auto w-52 rounded-[2.25rem] p-3.5 sm:w-60", BODY)}>
        <div className="mb-3 flex items-center justify-between px-4"><span className="size-1.5 rounded-full bg-emerald-400" /><span className="h-1.5 w-9 rounded-full bg-neutral-700" /><span className="size-2 rounded-full bg-neutral-700" /></div>
        <div className="h-56 overflow-hidden rounded-lg bg-neutral-950 p-0.5 sm:h-64"><div className="h-full overflow-hidden rounded-md"><Screen frames={frames} /></div></div>
        <p className="mt-2 text-center text-[8px] font-semibold tracking-[0.3em] text-neutral-400">REDIAL</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((k) => <span key={k} className="h-2.5 rounded-sm bg-neutral-700" />)}</div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="h-4 w-7 rounded bg-neutral-800 ring-1 ring-emerald-500/60" />
          <span className="flex size-12 items-center justify-center rounded-full bg-neutral-800"><span className="size-5 rounded-full bg-neutral-700" /></span>
          <span className="h-4 w-7 rounded bg-neutral-800 ring-1 ring-rose-500/60" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {KEYS.map((k) => <span key={k} className="flex h-6 items-center justify-center rounded-md bg-neutral-800 text-xs font-medium text-neutral-300">{k}</span>)}
        </div>
        <div className="mt-3 h-3" />
      </div>
      <div className="relative -mt-14 h-24 rounded-t-[2.5rem] rounded-b-2xl bg-neutral-800 shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/15" />
    </div>
  );
}

// A desk phone: corded handset on the left, screen and keypad on the right.
export function DeskPhone({ frames, className }: { frames: ScreenFrame[]; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-xl", className)} role="img" aria-label="A desk phone showing an AI assistant screening a call">
      <div className={cn("flex gap-3 rounded-[1.75rem] p-3.5 sm:gap-4 sm:p-5", BODY)}>
        <div className="flex w-14 shrink-0 flex-col justify-between rounded-2xl bg-neutral-950 p-2 ring-1 ring-white/5 sm:w-28 sm:p-2.5">
          <span className="text-[10px] font-bold text-neutral-400">HD</span>
          <span className="mx-auto h-32 w-2.5 rounded-full bg-white/5" />
          <span className="mx-auto h-1 w-10 rounded-full bg-white/10" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-stretch gap-2.5">
            <div className="hidden flex-col justify-around gap-2 sm:flex">{[0, 1, 2].map((k) => <span key={k} className="h-2.5 w-6 rounded-full bg-neutral-700"><span className="ml-auto block size-2 translate-x-0.5 rounded-full bg-emerald-400" /></span>)}</div>
            <div className="h-48 min-w-0 flex-1 overflow-hidden rounded-lg bg-neutral-950 p-0.5 sm:h-52"><div className="h-full overflow-hidden rounded-md"><Screen frames={frames} /></div></div>
            <div className="hidden flex-col justify-around gap-2 sm:flex">{[0, 1, 2].map((k) => <span key={k} className="h-2.5 w-6 rounded-full bg-neutral-700" />)}</div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => <span key={k} className="flex h-7 items-center justify-center rounded-md bg-neutral-800 text-xs font-semibold text-neutral-300">{k}</span>)}
            </div>
            <div className="flex flex-col items-center justify-between">
              <span className="flex size-16 items-center justify-center rounded-full bg-neutral-800"><span className="size-7 rounded-full bg-neutral-700" /></span>
              <span className="h-3 w-16 rounded-full bg-neutral-800" />
              <span className="flex gap-2"><span className="h-5 w-8 rounded bg-neutral-800" /><span className="h-5 w-8 rounded bg-neutral-800" /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
