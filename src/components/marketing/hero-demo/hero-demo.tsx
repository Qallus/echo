"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ClaudeScene, ConnectScene, EmailScene, PdfScene, RecordScene, SaveScene, TranscribeScene, WebReportScene,
} from "./scenes";

// Looping product demo for the landing page hero: record -> transcribe ->
// Claude -> email -> connections -> PDF -> web report -> save. Visitors can jump to a step.
// With reduced motion on, it holds each step's finished frame and doesn't advance.

type CursorStep = { at: number; target: string; click?: boolean };

const SCENES: { label: string; ms: number; Scene: React.ComponentType<{ t: number }>; cursor?: CursorStep[] }[] = [
  { label: "Record", ms: 3600, Scene: RecordScene },
  { label: "Transcribe", ms: 3800, Scene: TranscribeScene },
  { label: "Ask Claude", ms: 3800, Scene: ClaudeScene },
  {
    label: "Email", ms: 3400, Scene: EmailScene,
    cursor: [{ at: 700, target: "send" }, { at: 2000, target: "send", click: true }],
  },
  { label: "Connect", ms: 3400, Scene: ConnectScene },
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
    cursor: [{ at: 500, target: "personal" }, { at: 1400, target: "business" }, { at: 2000, target: "business", click: true }],
  },
];

const TICK = 100;

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function HeroDemo() {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [{ scene, t }, setPos] = useState({ scene: 0, t: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setPos((p) => (p.t + TICK < SCENES[p.scene].ms ? { scene: p.scene, t: p.t + TICK } : { scene: (p.scene + 1) % SCENES.length, t: 0 }));
    }, TICK);
    return () => clearInterval(id);
  }, [reduced]);

  const { Scene, cursor, label } = SCENES[scene];
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
    const s = stage.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    el.style.opacity = "1";
    el.style.transform = `translate(${r.left - s.left + r.width * 0.6}px, ${r.top - s.top + r.height * 0.6}px)`;
  }, [scene, step]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-2xl shadow-black/5">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="ml-3 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><Lock className="size-3 shrink-0" /> Personal · Launch plan review</span>
          <span className="ml-auto text-xs font-medium">{label}</span>
        </div>
        <div ref={stageRef} aria-hidden className="relative h-[430px] overflow-hidden sm:h-[460px]">
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
      </div>

      <nav aria-label="Demo steps" className="mt-4 flex flex-wrap justify-center gap-2">
        {SCENES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setPos({ scene: i, t: 0 })}
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
