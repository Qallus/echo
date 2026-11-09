"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AudioLines, BatteryFull, Lock, Signal, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ClaudeScene, ConnectScene, EmailScene, PdfScene, RecordScene, SaveScene, TranscribeScene, WebReportScene,
} from "./scenes";

// Looping product demos for the landing page hero, drawn in a phone (below
// md, or always with `phone`) or a monitor (md up). Echo: record -> transcribe -> Claude -> email ->
// connections -> PDF -> web report -> save. Redial's scenes are in
// redial-scenes.tsx. Visitors can jump to a step. With reduced motion on, it
// holds each step's finished frame and doesn't advance.

type CursorStep = { at: number; target: string; click?: boolean };
export type DemoScene = {
  label: string; ms: number; Scene: React.ComponentType<{ t: number }>; cursor?: CursorStep[];
  // Phone only: the scene fills the whole screen (no app header), like the
  // phone's own call screen. "dark" turns the status bar text white.
  screen?: "dark" | "light";
};

export const ECHO_SCENES: DemoScene[] = [
  {
    label: "Record", ms: 4400, Scene: RecordScene,
    cursor: [{ at: 2200, target: "flag" }, { at: 2900, target: "flag", click: true }],
  },
  { label: "Transcribe", ms: 5600, Scene: TranscribeScene },
  { label: "Ask Claude", ms: 5800, Scene: ClaudeScene },
  {
    label: "Email", ms: 5000, Scene: EmailScene,
    cursor: [{ at: 2500, target: "send" }, { at: 3300, target: "send", click: true }],
  },
  {
    label: "Connect", ms: 4400, Scene: ConnectScene,
    cursor: [{ at: 2500, target: "auto" }, { at: 3200, target: "auto", click: true }],
  },
  {
    label: "PDF report", ms: 4600, Scene: PdfScene,
    cursor: [{ at: 500, target: "play" }, { at: 1300, target: "play", click: true }],
  },
  {
    label: "Web report", ms: 5800, Scene: WebReportScene,
    cursor: [{ at: 2500, target: "report-play" }, { at: 3200, target: "report-play", click: true }],
  },
  {
    label: "Save", ms: 4200, Scene: SaveScene,
    cursor: [{ at: 500, target: "personal" }, { at: 1300, target: "business" }, { at: 2000, target: "business", click: true }],
  },
];

const TICK = 100;

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

type DemoProps = {
  scenes: readonly DemoScene[]; title: string; Logo?: React.ComponentType<{ className?: string }>;
  // Called each time the demo finishes its last step on its own (not after
  // the visitor picked a step).
  onLoop?: () => void;
  // Always a phone, at every screen size (Redial is a phone app).
  phone?: boolean;
};

export function HeroDemo(props: Partial<DemoProps>) {
  return <DeviceDemo scenes={ECHO_SCENES} title="Launch plan review" {...props} />;
}

export function DeviceDemo({ scenes: SCENES, title, Logo = AudioLines, onLoop, phone = false }: DemoProps) {
  // Classes that turn the phone into a monitor from md up.
  const desk = (cls: string) => (phone ? "" : cls);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [{ scene, t }, setPos] = useState({ scene: 0, t: 0 });
  const picked = useRef(false);
  const last = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setPos((p) => (p.t + TICK < SCENES[p.scene].ms ? { scene: p.scene, t: p.t + TICK } : { scene: (p.scene + 1) % SCENES.length, t: 0 }));
    }, TICK);
    return () => clearInterval(id);
  }, [reduced, SCENES]);

  // A full loop on its own (last step -> first) tells the parent.
  useEffect(() => {
    if (last.current === SCENES.length - 1 && scene === 0 && !picked.current) onLoop?.();
    last.current = scene;
  }, [scene, SCENES.length, onLoop]);

  const { Scene, cursor, label } = SCENES[scene];
  const full = phone ? SCENES[scene].screen : undefined;
  const shownT = reduced ? SCENES[scene].ms : t;
  const step = reduced ? undefined : cursor?.filter((c) => c.at <= t).at(-1);
  const clicking = step?.click && t - step.at < 500;

  // Move the cursor onto the element the current step points at.
  useEffect(() => {
    const stage = stageRef.current;
    const el = cursorRef.current;
    if (!stage || !el) return;
    const target = step && stage.querySelector<HTMLElement>(`[data-cursor="${step.target}"]`);
    if (!target) {
      el.style.opacity = "0";
      el.style.transform = `translate(${stage.clientWidth * 0.7}px, ${stage.clientHeight * 0.9}px)`;
      return;
    }
    // The canvas is scaled to fit its device frame, so convert screen pixels
    // back into canvas pixels.
    const s = stage.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const k = s.width / stage.offsetWidth || 1;
    el.style.opacity = "1";
    el.style.transform = `translate(${(r.left - s.left + r.width * 0.6) / k}px, ${(r.top - s.top + r.height * 0.6) / k}px)`;
  }, [scene, step]);

  // The demo is laid out on a fixed canvas (a 375×812 phone screen, or an
  // 840×525 desktop screen from md up) and scaled to fill the frame's screen,
  // so it keeps its proportions at every size.
  useLayoutEffect(() => {
    const screen = screenRef.current;
    const canvas = canvasRef.current;
    if (!screen || !canvas) return;
    const fit = () => { canvas.style.transform = `scale(${screen.clientWidth / canvas.offsetWidth})`; };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(screen);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Device body: a phone below md, a monitor from md up (unless `phone`). */}
      <div className={cn(
        "relative mx-auto w-full max-w-[420px] rounded-[3.25rem] bg-neutral-900 p-[3%] shadow-2xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/15",
        phone ? "md:max-w-[min(400px,calc((100svh-9rem)*0.47))] md:p-3" : "md:max-w-[min(72rem,calc((100svh-9rem)*1.5))] md:rounded-[1.25rem] md:p-[1.1%] md:pb-[2.8%]",
      )}>
        <span className={cn("absolute top-[18%] -left-[3px] h-[7%] w-[3px] rounded-l bg-neutral-700", desk("md:hidden"))} />
        <span className={cn("absolute top-[28%] -left-[3px] h-[11%] w-[3px] rounded-l bg-neutral-700", desk("md:hidden"))} />
        <span className={cn("absolute top-[24%] -right-[3px] h-[14%] w-[3px] rounded-r bg-neutral-700", desk("md:hidden"))} />

        <div ref={screenRef} className={cn("relative aspect-[375/812] overflow-hidden rounded-[2.6rem] bg-background", desk("md:aspect-[16/10] md:rounded-md"))}>
          <div ref={canvasRef} className={cn("@container absolute top-0 left-0 flex h-[812px] w-[375px] origin-top-left flex-col", desk("md:h-[525px] md:w-[840px]"))}>
            {/* Phone: status bar and app header. */}
            <div className={cn("flex h-12 shrink-0 items-end justify-between px-8 pb-1.5 text-[13px] font-semibold", desk("md:hidden"), full && "absolute inset-x-0 top-0 z-10", full === "dark" && "text-white")}>
              <span>9:41</span>
              <span className="flex items-center gap-1.5"><Signal className="size-3.5" /><Wifi className="size-3.5" /><BatteryFull className="size-4" /></span>
            </div>
            <div className={cn("flex h-11 shrink-0 items-center gap-2 border-b px-4", desk("md:hidden"), full && "hidden")}>
              <Logo className="size-4" />
              <span className="min-w-0 truncate text-sm font-medium">{title}</span>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{label}</span>
            </div>
            {/* Desktop: browser bar. */}
            {!phone && <div className="hidden h-9 shrink-0 items-center gap-1.5 border-b bg-muted/40 px-4 md:flex">
              <span className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="ml-3 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><Lock className="size-3 shrink-0" /> {title}</span>
              <span className="ml-auto text-xs font-medium">{label}</span>
            </div>}

            <div ref={stageRef} aria-hidden className="relative min-h-0 flex-1 overflow-hidden">
              <div key={scene} className="hero-in h-full">
                <Scene t={shownT} />
              </div>
              <div
                ref={cursorRef}
                className="pointer-events-none absolute top-0 left-0 opacity-0 transition-[transform,opacity] duration-700 ease-out"
              >
                {clicking && <span key={`${scene}-${step?.at}`} className="hero-click absolute -top-3 -left-3 size-6 rounded-full bg-foreground/30" />}
                <svg viewBox="0 0 24 24" className="relative size-5 drop-shadow" aria-hidden>
                  <path d="M5 3l14 8-6.5 1.5L9 19z" className="fill-foreground stroke-background" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Phone: home indicator. */}
            <div className={cn("flex h-7 shrink-0 items-center justify-center", desk("md:hidden"), full && "absolute inset-x-0 bottom-0 z-10")}>
              <span className={cn("h-1.5 w-32 rounded-full", full === "dark" ? "bg-white/80" : "bg-foreground/80")} />
            </div>
          </div>
          {/* Phone: Dynamic Island. */}
          <span className={cn("absolute top-[1.4%] left-1/2 h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-neutral-900", desk("md:hidden"))} />
        </div>

        {/* Monitor: logo on the chin. */}
        {!phone && <Logo className="absolute bottom-[0.7%] left-1/2 hidden size-[1.6%] min-h-3 min-w-3 -translate-x-1/2 text-neutral-500 md:block" />}
      </div>

      {/* Monitor: stand. */}
      {!phone && <div aria-hidden className="hidden md:block">
        <div className="mx-auto h-[clamp(28px,4vw,56px)] w-[14%] bg-gradient-to-b from-neutral-400 to-neutral-300 [clip-path:polygon(14%_0,86%_0,100%_100%,0_100%)]" />
        <div className="mx-auto h-3 w-[30%] rounded-t-sm rounded-b-xl bg-gradient-to-b from-neutral-300 to-neutral-400 shadow-md" />
      </div>}

      <nav aria-label="Demo steps" className="mt-6 flex flex-wrap justify-center gap-2">
        {SCENES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => { picked.current = true; setPos({ scene: i, t: 0 }); }}
            aria-current={i === scene ? "step" : undefined}
            className={cn(
              "relative overflow-hidden rounded-full border px-3 py-1 text-xs transition-colors",
              i === scene ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i === scene && !reduced && (
              <span className="absolute inset-y-0 left-0 bg-muted transition-[width] duration-100 ease-linear" style={{ width: `${(t / s.ms) * 100}%` }} />
            )}
            <span className="relative">{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
