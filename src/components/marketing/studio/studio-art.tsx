"use client";

import { useEffect, useState } from "react";
import { Mic, Music, Sparkles, Wand2 } from "lucide-react";
import { Waveform } from "@/components/marketing/hero-demo/scenes";
import { cn } from "@/lib/utils";

// The Recording Studio drawn as a black console (same body style as the
// drawn phones). The screen follows the theme tokens. It spends most of its
// time on the AI voice, stepping through the three engines, then switches to
// the Background music tab to show the drum machine. Held on the first frame
// when the visitor prefers reduced motion.

const ENGINES = [
  { id: "OpenAI", voice: "Onyx", detail: "Deep, authoritative" },
  { id: "xAI (Grok)", voice: "Eve", detail: "Bright, upbeat" },
  { id: "Gemini", voice: "Charon", detail: "Informative" },
];
const SCRIPT = "Thank you for calling Summit Roofing. For sales, press 1. For service, press 2.";
const DRUMS: { label: string; on: number[] }[] = [
  { label: "Kick", on: [0, 4, 8, 12] },
  { label: "Snare", on: [4, 12] },
  { label: "Hi-hat", on: [0, 2, 4, 6, 8, 10, 12, 14] },
  { label: "Clap", on: [12] },
  { label: "Piano", on: [0, 3, 6, 10] },
  { label: "Bass", on: [0, 7, 8, 15] },
];
// Three voice frames (one per engine), then one music frame.
const FRAMES = ENGINES.length + 1;

function useTick(ms: number, count: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [ms, count]);
  return i;
}

const KNOB = "rounded-full bg-gradient-to-b from-neutral-700 to-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_2px_4px_rgba(0,0,0,.6)]";
const SEG = "flex gap-1 rounded-md border bg-muted/40 p-0.5";
const seg = (on: boolean) => cn("flex-1 rounded px-1.5 py-1 text-center transition-colors", on ? "bg-background font-medium shadow-sm" : "text-muted-foreground");

export function StudioArt({ className }: { className?: string }) {
  const frame = useTick(3200, FRAMES);
  const music = frame === ENGINES.length;
  const engine = ENGINES[music ? ENGINES.length - 1 : frame];
  const step = useTick(220, 16);
  return (
    <div className={cn("relative mx-auto w-full max-w-xl", className)} role="img" aria-label="The Recording Studio making a phone menu greeting with an AI voice, then adding a drum beat">
      <div className="rounded-[1.75rem] bg-gradient-to-b from-neutral-800 to-neutral-900 p-3 shadow-[0_0_0_1px_rgba(0,0,0,.12),inset_0_1px_0_rgba(255,255,255,.09),0_30px_50px_-20px_rgba(0,0,0,.45)] sm:p-4 dark:from-neutral-700 dark:to-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,.14),inset_0_1px_0_rgba(255,255,255,.14),0_30px_50px_-20px_rgba(0,0,0,.9)]">
        <div className="flex items-center justify-between px-2 pb-2.5">
          <span className="flex items-center gap-1.5"><span className="led-pulse size-1.5 rounded-full bg-emerald-400" /><span className="text-[9px] font-bold tracking-[0.3em] text-neutral-400">REDIAL STUDIO</span></span>
          <span className="flex gap-1.5">{[0, 1, 2].map((k) => <span key={k} className={cn(KNOB, "size-3.5")} />)}</span>
        </div>
        <div className="overflow-hidden rounded-2xl bg-black p-[3px]">
          <div className="space-y-3 rounded-[13px] bg-background p-4 text-foreground">
            <div className={cn(SEG, "text-[11px]")}>
              <span className={cn(seg(!music), "flex items-center justify-center gap-1.5 py-1.5")}><Mic className="size-3.5" /> Voiceover</span>
              <span className={cn(seg(music), "flex items-center justify-center gap-1.5 py-1.5")}><Music className="size-3.5" /> Background music</span>
            </div>

            <div className="h-[11.5rem]">
              {music ? (
                <div key="music" className="hero-in space-y-2.5">
                  <div className={cn(SEG, "text-[10px]")}>{["Upload", "Drum machine", "AI Beats"].map((t) => <span key={t} className={seg(t === "Drum machine")}>{t}</span>)}</div>
                  <p className="text-[11px] font-medium">Drum machine · 90 BPM</p>
                  <div className="space-y-1">
                    {DRUMS.map((d) => (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-[9px] text-muted-foreground">{d.label}</span>
                        <div className="grid flex-1 grid-cols-16 gap-[3px]">
                          {Array.from({ length: 16 }, (_, s) => (
                            <span key={s} className={cn("h-2.5 rounded-[2px] transition-colors", d.on.includes(s) ? (s === step ? "bg-primary" : "bg-foreground/70") : s === step ? "bg-muted-foreground/40" : "bg-muted")} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div key="voice" className="space-y-3">
                  <div className={cn(SEG, "text-[10px]")}>{["Record", "Upload", "AI voice"].map((t) => <span key={t} className={seg(t === "AI voice")}>{t}</span>)}</div>
                  <div className={cn(SEG, "text-[10px]")}>{ENGINES.map((e) => <span key={e.id} className={seg(e.id === engine.id)}>{e.id}</span>)}</div>
                  <div className="flex items-center gap-3">
                    <div key={engine.id} className="hero-in w-28 shrink-0 rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5">
                      <p className="text-xs font-semibold">{engine.voice}</p>
                      <p className="text-[10px] text-muted-foreground">{engine.detail}</p>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">&ldquo;{SCRIPT}&rdquo;</p>
                  </div>
                  <div className="flex h-11 items-center rounded-lg bg-muted/50 px-4"><Waveform live bars={40} className="h-7" /></div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t pt-3">
              <Wand2 className="size-3.5 shrink-0" />
              {[{ l: "Voice", v: 100 }, { l: "Music", v: 35 }].map((f) => (
                <div key={f.l} className="flex-1">
                  <p className="text-[9px] text-muted-foreground">{f.l} {f.v}%</p>
                  <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(f.v / 150) * 100}%` }} /></div>
                </div>
              ))}
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground"><Sparkles className="size-3" /> Save</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="flex gap-2">{[0, 1, 2, 3].map((k) => <span key={k} className="h-2 w-8 rounded-full bg-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] dark:bg-neutral-600" />)}</span>
          <span className="flex gap-2">{[0, 1].map((k) => <span key={k} className={cn(KNOB, "size-6")} />)}</span>
        </div>
      </div>
      <div className="absolute inset-x-[6%] -bottom-2 -z-10 h-10 rounded-full blur-[6px] [background:radial-gradient(ellipse,rgba(0,0,0,.3),transparent_68%)] dark:[background:radial-gradient(ellipse,rgba(0,0,0,.85),transparent_68%)]" />
    </div>
  );
}
