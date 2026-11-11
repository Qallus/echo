"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  AudioLines, Ban, Headphones, Mail, MicOff, Pause, Phone, PhoneForwarded, PhoneIncoming, PhoneOff, RotateCcw, Volume2, Wifi,
} from "lucide-react";
import { Named } from "@/components/marketing/agent-name";
import { cn } from "@/lib/utils";

// Drawn phones from the Claude Design project (docs/Business-Home-Phones): a
// Wi-Fi cordless handset in its charging stand (320×735) and a desk phone
// (680×520). Bodies stay black, lifted a little in dark mode so they separate
// from the page; the screens use the theme tokens. The screens step through a
// call the assistant screens, a few seconds a frame (held on the first frame
// when the visitor prefers reduced motion). Both are drawn at a fixed size and
// zoomed down on smaller screens.

export type ScreenFrame = { tag: string; title: string; detail: string; soft?: [string, string, string]; tone?: "call" | "dj" | "blocked" };

function useFrame(count: number, ms = 3200) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms]);
  return i;
}

function Screen({ f, size = "md" }: { f: ScreenFrame; size?: "md" | "lg" }) {
  const Icon = f.tone === "call" ? PhoneIncoming : f.tone === "blocked" ? Ban : AudioLines;
  const soft = f.soft ?? (f.tone === "call" ? ["Answer", "Redial", "Decline"] : ["Menu", "Redial", "History"]);
  const lg = size === "lg";
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[10px] bg-background text-foreground dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">
      <div className="flex items-center justify-between px-2.5 pt-2 text-[10.5px] text-muted-foreground"><Wifi className="size-3.5" /><span>11:40</span></div>
      <div key={f.title + f.tag} className="hero-in flex flex-1 flex-col items-center justify-center gap-1.5 px-3.5 text-center">
        <span className={cn("flex items-center justify-center rounded-full", lg ? "size-10" : "size-[38px]", f.tone === "blocked" ? "bg-destructive/10 text-destructive" : "bg-muted")}>
          <Icon className={cn("size-[17px]", f.tone === "dj" && "animate-pulse")} />
        </span>
        <p className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase"><Named text={f.tag} /></p>
        <p className={cn("leading-tight font-semibold", lg ? "text-base" : "text-[15.5px]")}><Named text={f.title} /></p>
        <p className={cn("leading-snug text-muted-foreground", lg ? "text-xs" : "text-[11.5px]")}><Named text={f.detail} /></p>
      </div>
      <div className="grid grid-cols-3 border-t px-1 py-1.5 text-center text-[10px] text-muted-foreground"><span>{soft[0]}</span><span>{soft[1]}</span><span>{soft[2]}</span></div>
    </div>
  );
}

const KEYS: [string, string][] = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
const FKEYS = [Headphones, MicOff, Mail, Pause, PhoneForwarded, AudioLines];

const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });
const KEY = "rounded-[9px] bg-gradient-to-b from-neutral-800 to-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_3px_0_#0c0c0c,0_5px_8px_rgba(0,0,0,.5)] dark:from-neutral-700 dark:to-neutral-800 dark:shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_3px_0_#111,0_5px_8px_rgba(0,0,0,.7)]";
const PILL = "h-2.5 rounded-full bg-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] dark:bg-neutral-600";
const ARROW = "#8a8a8a";

function NavRing({ size, inset, arrow, text }: { size: number; inset: number; arrow: number; text: string }) {
  const b = `${arrow + 1}px solid ${ARROW}`;
  const o = Math.round(size / 10);
  return (
    <div className="relative rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_4px_10px_rgba(0,0,0,.5)] [background:radial-gradient(circle_at_50%_40%,#2e2e2e,#1a1a1a)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_4px_10px_rgba(0,0,0,.7)] dark:[background:radial-gradient(circle_at_50%_40%,#3d3d3d,#242424)]" style={{ width: size, height: size }}>
      {(["top", "bottom", "left", "right"] as const).map((d) => (
        <span key={d} className="absolute border-transparent" style={{
          borderWidth: arrow,
          ...(d === "top" ? { left: "50%", top: o, transform: "translateX(-50%)", borderBottom: b, borderTopWidth: 0 }
            : d === "bottom" ? { left: "50%", bottom: o, transform: "translateX(-50%)", borderTop: b, borderBottomWidth: 0 }
              : d === "left" ? { top: "50%", left: o, transform: "translateY(-50%)", borderRight: b, borderLeftWidth: 0 }
                : { top: "50%", right: o, transform: "translateY(-50%)", borderLeft: b, borderRightWidth: 0 }),
        }} />
      ))}
      <div className={cn("absolute grid place-items-center rounded-full bg-neutral-950 font-bold text-neutral-400 shadow-[inset_0_2px_4px_rgba(0,0,0,.8),0_0_0_1px_rgba(255,255,255,.06)] dark:bg-neutral-900 dark:text-neutral-300", text)} style={{ inset }}>OK</div>
    </div>
  );
}

// A Wi-Fi cordless handset standing in its charging stand.
export function CordlessPhone({ frames, className }: { frames: ScreenFrame[]; className?: string }) {
  const f = frames[useFrame(frames.length)];
  return (
    <div className={cn("relative mx-auto h-[735px] w-[320px] max-sm:[zoom:0.85]", className)} role="img" aria-label="A Wi-Fi cordless phone in its charging stand showing an AI assistant screening a call">
      {/* desk shadow */}
      <div className="absolute inset-x-0 bottom-[-8px] h-[60px] rounded-full blur-[6px] [background:radial-gradient(ellipse,rgba(0,0,0,.34),transparent_68%)] dark:[background:radial-gradient(ellipse,rgba(0,0,0,.9),transparent_68%)]" />
      {/* stand, back */}
      <div className="absolute rounded-t-[44px] rounded-b-[26px] bg-gradient-to-b from-[#242424] to-[#141414] shadow-[0_0_0_1px_rgba(0,0,0,.12),inset_0_1px_0_rgba(255,255,255,.1),0_30px_50px_-20px_rgba(0,0,0,.45)] dark:from-[#303030] dark:to-[#1c1c1c] dark:shadow-[0_0_0_1px_rgba(255,255,255,.14),inset_0_1px_0_rgba(255,255,255,.14),0_30px_50px_-20px_rgba(0,0,0,.9)]" style={abs({ left: 0, top: 585, width: 320, height: 150 })}>
        <div className="absolute inset-x-9 -top-0.5 h-10 rounded-b-[30px] bg-[#0a0a0a] shadow-[inset_0_-3px_6px_rgba(0,0,0,.8)] dark:bg-[#0d0d0d]" />
      </div>
      {/* handset */}
      <div className="absolute flex flex-col gap-3 px-4 pt-[18px] [border-radius:52px_52px_40px_40px/56px_56px_44px_44px] bg-gradient-to-r from-[#262626] via-[#1a1a1a] via-40% to-[#111] shadow-[0_0_0_1px_rgba(0,0,0,.14),inset_1px_1px_0_rgba(255,255,255,.12),inset_-2px_-2px_6px_rgba(0,0,0,.5),0_24px_34px_-14px_rgba(0,0,0,.6)] dark:from-[#363636] dark:via-[#262626] dark:to-[#1a1a1a] dark:shadow-[0_0_0_1px_rgba(255,255,255,.14),inset_1px_1px_0_rgba(255,255,255,.18),inset_-2px_-2px_6px_rgba(0,0,0,.5),0_24px_34px_-14px_rgba(0,0,0,.9)]" style={abs({ left: 44, top: 0, width: 232, height: 650 })}>
        <div className="flex h-3.5 items-center justify-between px-3.5">
          <span className="size-1.5 led-pulse rounded-full bg-emerald-400" />
          <span className="h-1.5 w-12 rounded-[3px] bg-[#050505] shadow-[inset_0_1px_2px_rgba(0,0,0,.9),0_1px_0_rgba(255,255,255,.06)]" />
          <span className="size-[7px] rounded-full bg-[#050505] shadow-[inset_0_1px_1px_rgba(0,0,0,.9),0_1px_0_rgba(255,255,255,.06)]" />
        </div>
        <div className="h-64 shrink-0 rounded-xl bg-[#0a0a0a] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)] dark:bg-black dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]"><Screen f={f} size="lg" /></div>
        <p className="text-center text-[8px] font-bold tracking-[0.3em] text-neutral-500">REDIAL</p>
        <div className="grid grid-cols-3 gap-2 px-1">{[0, 1, 2].map((k) => <span key={k} className="h-2.5 rounded-[5px] bg-[#2a2a2a] shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_2px_0_#0c0c0c] dark:bg-[#383838] dark:shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_2px_0_#111]" />)}</div>
        <div className="flex items-center justify-between px-2">
          <span className={cn(KEY, "grid h-[22px] w-10 place-items-center rounded-[7px] text-emerald-400")}><Phone className="size-[13px]" strokeWidth={2.4} /></span>
          <NavRing size={72} inset={22} arrow={4} text="text-[8px]" />
          <span className={cn(KEY, "grid h-[22px] w-10 place-items-center rounded-[7px] text-red-400")}><PhoneOff className="size-[13px]" strokeWidth={2.4} /></span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-1">
          {KEYS.map(([d, l]) => (
            <div key={d} className={cn(KEY, "flex h-[30px] items-center justify-center gap-1 rounded-lg text-neutral-200 dark:text-neutral-100")}><span className="text-sm font-semibold">{d}</span><span className="text-[7px] font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">{l}</span></div>
          ))}
        </div>
      </div>
      {/* stand, front wall (in front of the handset) */}
      <div className="absolute rounded-t-[34px] rounded-b-[26px] bg-gradient-to-b from-[#262626] to-[#141414] shadow-[0_0_0_1px_rgba(0,0,0,.12),inset_0_1px_0_rgba(255,255,255,.12),0_-10px_18px_-8px_rgba(0,0,0,.6)] dark:from-[#333] dark:to-[#1c1c1c] dark:shadow-[0_0_0_1px_rgba(255,255,255,.14),inset_0_1px_0_rgba(255,255,255,.16),0_-10px_18px_-8px_rgba(0,0,0,.9)]" style={abs({ left: 0, top: 618, width: 320, height: 117 })}>
        <div className="absolute inset-x-0 bottom-0 h-[9px] rounded-b-[26px] bg-[#3a3a3a] shadow-[inset_0_1px_0_rgba(255,255,255,.14)] dark:bg-[#4a4a4a] dark:shadow-[inset_0_1px_0_rgba(255,255,255,.18)]" />
      </div>
    </div>
  );
}

// A desk phone: the handset resting in its cradle on the left, the nav
// cluster, keypad and function keys on the base, and a raised screen with
// line keys.
export function DeskPhone({ frames, className }: { frames: ScreenFrame[]; className?: string }) {
  const f = frames[useFrame(frames.length)];
  return (
    <div className={cn("relative mx-auto h-[520px] w-[680px] max-sm:[zoom:0.52] sm:max-lg:[zoom:0.85]", className)} role="img" aria-label="A desk phone showing an AI assistant screening a call">
      {/* desk shadow */}
      <div className="absolute right-[4%] bottom-[-6px] left-[4%] h-14 rounded-full blur-[6px] [background:radial-gradient(ellipse,rgba(0,0,0,.34),transparent_68%)] dark:[background:radial-gradient(ellipse,rgba(0,0,0,.9),transparent_68%)]" />
      {/* stand neck */}
      <div className="absolute rounded-b-[10px] bg-gradient-to-b from-neutral-950 to-neutral-900 dark:from-neutral-900 dark:to-neutral-800 dark:ring-1 dark:ring-white/5" style={abs({ left: 372, top: 230, width: 180, height: 40 })} />
      {/* base */}
      <div className="absolute rounded-t-[14px] rounded-b-[20px] bg-gradient-to-b from-neutral-900 to-neutral-950 shadow-[0_0_0_1px_rgba(0,0,0,.12),inset_0_1px_0_rgba(255,255,255,.09),0_30px_50px_-20px_rgba(0,0,0,.45)] dark:from-neutral-800 dark:to-neutral-900 dark:shadow-[0_0_0_1px_rgba(255,255,255,.14),inset_0_1px_0_rgba(255,255,255,.14),0_30px_50px_-20px_rgba(0,0,0,.9)]" style={abs({ left: 0, top: 250, width: 680, height: 262 })}>
        <div className="absolute inset-x-0 bottom-0 h-[9px] rounded-b-[20px] bg-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,.14)] dark:bg-neutral-600" />
        <div className="grid h-full gap-[22px] px-[26px] pt-[22px] pb-[26px]" style={{ gridTemplateColumns: "124px 112px 1fr 118px" }}>
          {/* cradle */}
          <div className="relative"><div className="absolute inset-x-0.5 -top-2.5 bottom-1 rounded-[22px] bg-neutral-950 shadow-[inset_0_2px_6px_rgba(0,0,0,.8),inset_0_-1px_0_rgba(255,255,255,.05)]" /></div>
          {/* nav cluster + volume */}
          <div className="flex flex-col items-center justify-between pt-2 pb-1">
            <NavRing size={104} inset={30} arrow={5} text="text-[10px]" />
            <div className="flex gap-2">
              <span className="grid h-[22px] w-[34px] place-items-center rounded-[7px] bg-neutral-800 text-[11px] text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_2px_4px_rgba(0,0,0,.5)] dark:bg-neutral-700 dark:text-neutral-300">✕</span>
              <span className="grid h-[22px] w-[34px] place-items-center rounded-[7px] bg-neutral-800 text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_2px_4px_rgba(0,0,0,.5)] dark:bg-neutral-700 dark:text-neutral-300"><RotateCcw className="size-[11px]" strokeWidth={2.5} /></span>
            </div>
            <div className="flex h-6 w-[104px] items-center justify-between rounded-xl bg-neutral-800 px-3.5 text-sm font-semibold text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_3px_6px_rgba(0,0,0,.5)] dark:bg-neutral-700 dark:text-neutral-300"><span>−</span><span className="h-3 w-px bg-neutral-700 dark:bg-neutral-600" /><span>+</span></div>
          </div>
          {/* keypad */}
          <div className="grid grid-cols-3 grid-rows-4 gap-2.5 px-1.5 py-1">
            {KEYS.map(([d, l]) => (
              <div key={d} className={cn(KEY, "flex items-center justify-center gap-[5px] text-neutral-200 dark:text-neutral-100")}><span className="text-[17px] font-semibold">{d}</span><span className="text-[8px] font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">{l}</span></div>
            ))}
          </div>
          {/* function keys */}
          <div className="grid auto-rows-fr grid-cols-2 gap-2.5 py-1 text-neutral-400 dark:text-neutral-300">
            {FKEYS.map((Icon, i) => <div key={i} className={cn(KEY, "grid place-items-center")}><Icon className="size-[15px]" /></div>)}
            <div className={cn(KEY, "col-span-2 grid place-items-center")}><Volume2 className="size-[15px]" /></div>
          </div>
        </div>
      </div>
      {/* handset, seen from the back, resting in the cradle */}
      <div className="absolute rounded-t-[22px] rounded-b-[18px] bg-gradient-to-r from-neutral-800 via-neutral-900 via-[38%] to-neutral-950 shadow-[inset_1px_1px_0_rgba(255,255,255,.14),inset_-3px_-3px_8px_rgba(0,0,0,.45),0_18px_24px_rgba(0,0,0,.45)] dark:from-neutral-700 dark:via-neutral-800 dark:to-neutral-900 dark:shadow-[inset_1px_1px_0_rgba(255,255,255,.2),inset_-3px_-3px_8px_rgba(0,0,0,.45),0_18px_24px_rgba(0,0,0,.45)]" style={abs({ left: 26, top: 96, width: 120, height: 392 })}>
        <span className="absolute inset-x-0 bottom-[30px] text-center text-[9px] font-bold tracking-wide text-neutral-500 dark:text-neutral-400">HD</span>
      </div>
      {/* display panel */}
      <div className="absolute grid gap-2.5 rounded-2xl bg-gradient-to-b from-neutral-800 to-neutral-900 p-4 pb-3 shadow-[0_0_0_1px_rgba(0,0,0,.14),inset_0_1px_0_rgba(255,255,255,.1),0_24px_34px_-16px_rgba(0,0,0,.6)] dark:from-neutral-700 dark:to-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,.14),inset_0_1px_0_rgba(255,255,255,.16),0_24px_34px_-16px_rgba(0,0,0,.9)]" style={abs({ left: 262, top: 0, width: 400, height: 262, gridTemplateColumns: "44px 1fr 44px", gridTemplateRows: "1fr 22px" })}>
        <div className="flex flex-col justify-around py-2.5">
          <span className={cn(PILL, "flex items-center justify-end pr-[3px]")}><span className="size-[5px] led-pulse rounded-full bg-emerald-400" /></span>
          <span className={PILL} /><span className={PILL} /><span className={PILL} />
        </div>
        <div className="rounded-[10px] bg-neutral-950 p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)] dark:bg-black dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]"><Screen f={f} /></div>
        <div className="flex flex-col justify-around py-2.5"><span className={PILL} /><span className={PILL} /><span className={PILL} /><span className={PILL} /></div>
        <span className="col-start-1 self-center text-center text-[7.5px] font-bold tracking-[0.28em] text-neutral-500 dark:text-neutral-400">REDIAL</span>
        <div className="col-start-2 grid grid-cols-4 gap-3 px-3.5">{[0, 1, 2, 3].map((k) => <span key={k} className="rounded-md bg-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_2px_0_#0c0c0c] dark:bg-neutral-700 dark:shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_2px_0_#111]" />)}</div>
      </div>
    </div>
  );
}
