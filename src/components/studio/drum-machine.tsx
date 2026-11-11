"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Play, Sparkles, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import {
  DRUMS,
  MELODIC,
  defaultPattern,
  isSharp,
  noteFreq,
  renderPatternToBuffer,
  rollNotes,
  scheduleDrum,
  scheduleMelodic,
  type DrumTrackId,
  type MelodicTrackId,
  type Pattern,
} from "@/lib/studio/drum-engine";
import { cn } from "@/lib/utils";

export function DrumMachine({
  pattern,
  onChange,
  onUse,
}: {
  pattern: Pattern;
  onChange: (p: Pattern) => void;
  onUse: (buffer: AudioBuffer, name: string) => void;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const patternRef = useRef(pattern);

  const [playing, setPlaying] = useState(false);
  const [playStep, setPlayStep] = useState(-1);
  const [master, setMaster] = useState(0.9);
  const masterRef = useRef(master);
  // The scheduler reads the latest pattern and level between renders.
  useEffect(() => {
    patternRef.current = pattern;
    masterRef.current = master;
  }, [pattern, master]);
  const [bars, setBars] = useState(2);
  const [rendering, setRendering] = useState(false);
  const [melInst, setMelInst] = useState<MelodicTrackId>("piano");
  const [octave, setOctave] = useState(3);

  const getCtx = () => (ctxRef.current ??= new AudioContext({ sampleRate: 44100 }));

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  function tick() {
    const ctx = getCtx();
    const p = patternRef.current;
    const stepDur = 60 / p.bpm / 4;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const step = stepRef.current;
      const t = nextTimeRef.current;
      const m = masterRef.current;
      for (const { id } of DRUMS) {
        if (p.drums[id][step] && !p.drumMutes[id]) scheduleDrum(ctx, ctx.destination, id, t, p.drumGains[id] * m);
      }
      for (const { id } of MELODIC) {
        const note = p.melodic[id][step];
        if (note && !p.melodicMutes[id]) scheduleMelodic(ctx, ctx.destination, id, noteFreq(note), t, p.melodicGains[id] * m);
      }
      window.setTimeout(() => setPlayStep(step), Math.max(0, (t - ctx.currentTime) * 1000));
      stepRef.current = (step + 1) % p.steps;
      nextTimeRef.current += stepDur;
    }
    timerRef.current = window.setTimeout(tick, 30);
  }
  function play() {
    const ctx = getCtx();
    if (ctx.state === "suspended") void ctx.resume();
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.1;
    setPlaying(true);
    tick();
  }
  function stop() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setPlayStep(-1);
  }

  function resume() {
    const ctx = getCtx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }
  const previewDrum = (id: DrumTrackId) => {
    const ctx = resume();
    scheduleDrum(ctx, ctx.destination, id, ctx.currentTime + 0.02, pattern.drumGains[id] * master);
  };
  const previewMel = (id: MelodicTrackId) => {
    const ctx = resume();
    scheduleMelodic(ctx, ctx.destination, id, noteFreq(`C${octave}`), ctx.currentTime + 0.02, pattern.melodicGains[id] * master);
  };

  // drum edits
  const toggleDrum = (id: DrumTrackId, step: number) =>
    onChange({ ...pattern, drums: { ...pattern.drums, [id]: pattern.drums[id].map((v, i) => (i === step ? !v : v)) } });
  const setDrumGain = (id: DrumTrackId, v: number) => onChange({ ...pattern, drumGains: { ...pattern.drumGains, [id]: v } });
  const toggleDrumMute = (id: DrumTrackId) => onChange({ ...pattern, drumMutes: { ...pattern.drumMutes, [id]: !pattern.drumMutes[id] } });
  // melodic edits
  const setMelNote = (step: number, note: string) => {
    const cur = pattern.melodic[melInst][step];
    const next = pattern.melodic[melInst].map((v, i) => (i === step ? (cur === note ? null : note) : v));
    onChange({ ...pattern, melodic: { ...pattern.melodic, [melInst]: next } });
  };
  const setMelGain = (v: number) => onChange({ ...pattern, melodicGains: { ...pattern.melodicGains, [melInst]: v } });
  const toggleMelMute = () => onChange({ ...pattern, melodicMutes: { ...pattern.melodicMutes, [melInst]: !pattern.melodicMutes[melInst] } });

  async function useAsMusic() {
    setRendering(true);
    try {
      onUse(await renderPatternToBuffer(patternRef.current, bars), `Beat · ${pattern.bpm} BPM`);
    } finally {
      setRendering(false);
    }
  }

  const notes = rollNotes(octave).slice().reverse(); // high on top

  return (
    <div className="space-y-4">
      {/* Transport */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        {playing ? (
          <Button variant="destructive" size="sm" onClick={stop}><Square className="h-4 w-4" /> Stop</Button>
        ) : (
          <Button size="sm" onClick={play}><Play className="h-4 w-4" /> Play</Button>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Tempo <span className="w-10 text-right font-medium text-foreground">{pattern.bpm}</span>
          <input type="range" min={60} max={180} value={pattern.bpm} onChange={(e) => onChange({ ...pattern, bpm: Number(e.target.value) })} className="w-28 accent-primary" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-4 w-4" />
          <input type="range" min={0} max={1} step={0.05} value={master} onChange={(e) => setMaster(Number(e.target.value))} className="w-20 accent-primary" />
        </label>
        <Button variant="ghost" size="sm" onClick={() => onChange(defaultPattern(pattern.steps))} title="Reset pattern">
          <Eraser className="h-4 w-4" /> Reset
        </Button>
      </div>

      {/* Drum grid */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[760px]">
          {DRUMS.map(({ id, label }) => (
            <div key={id} className="flex items-center gap-2 border-b border-border px-2 py-1 last:border-0">
              <button onClick={() => previewDrum(id)} className="w-20 shrink-0 text-left text-xs font-medium text-foreground hover:text-primary" title="Preview">{label}</button>
              <button onClick={() => toggleDrumMute(id)} className={cn("w-7 shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold", pattern.drumMutes[id] ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{pattern.drumMutes[id] ? "M" : "on"}</button>
              <input type="range" min={0} max={1} step={0.05} value={pattern.drumGains[id]} onChange={(e) => setDrumGain(id, Number(e.target.value))} className="w-14 shrink-0 accent-primary" title="Level" />
              <div className="flex flex-1 gap-1">
                {pattern.drums[id].map((on, step) => (
                  <button key={step} onClick={() => toggleDrum(id, step)} className={cn("h-6 flex-1 rounded-sm border transition-colors", step % 4 === 0 ? "border-border/80" : "border-border/40", on ? "bg-primary" : "bg-muted/40 hover:bg-muted", playStep === step && "ring-2 ring-primary/60")} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Melodic piano roll */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border bg-muted/40 p-1">
            {MELODIC.map((m) => (
              <button key={m.id} onClick={() => setMelInst(m.id)} className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", melInst === m.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{m.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Octave
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOctave((o) => Math.max(1, o - 1))}>−</Button>
            <span className="w-4 text-center font-medium text-foreground">{octave}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOctave((o) => Math.min(6, o + 1))}>+</Button>
          </div>
          <button onClick={() => previewMel(melInst)} className="text-xs font-medium text-foreground hover:text-primary">Preview</button>
          <button onClick={toggleMelMute} className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", pattern.melodicMutes[melInst] ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{pattern.melodicMutes[melInst] ? "Muted" : "On"}</button>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Level
            <input type="range" min={0} max={1} step={0.05} value={pattern.melodicGains[melInst]} onChange={(e) => setMelGain(Number(e.target.value))} className="w-16 accent-primary" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px] space-y-0.5">
            {notes.map((note) => (
              <div key={note} className="flex items-center gap-2">
                <span className={cn("w-10 shrink-0 text-right text-[10px]", isSharp(note) ? "text-muted-foreground/60" : "text-muted-foreground")}>{note}</span>
                <div className={cn("flex flex-1 gap-1 rounded", isSharp(note) && "bg-muted/20")}>
                  {Array.from({ length: pattern.steps }).map((_, step) => {
                    const active = pattern.melodic[melInst][step] === note;
                    return (
                      <button key={step} onClick={() => setMelNote(step, note)} className={cn("h-4 flex-1 rounded-sm border transition-colors", step % 4 === 0 ? "border-border/80" : "border-border/30", active ? "bg-primary" : "bg-muted/30 hover:bg-muted", playStep === step && "ring-1 ring-primary/50")} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Render */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Loop length
          <Pick label="Loop length" size="sm" className="w-28" value={String(bars)} onChange={(v) => setBars(Number(v))} options={[{ value: "1", label: "1 bar" }, { value: "2", label: "2 bars" }, { value: "4", label: "4 bars" }]} />
        </label>
        <Button onClick={useAsMusic} disabled={rendering}>
          <Sparkles className="h-4 w-4" /> {rendering ? "Rendering…" : "Use as background music"}
        </Button>
      </div>
    </div>
  );
}
