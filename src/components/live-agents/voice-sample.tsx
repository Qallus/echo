"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { VoiceSample } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// A voice clip with a waveform-style progress bar. Only one clip plays at a
// time across the page. The bars are decorative (seeded from the clip id).

let current: HTMLAudioElement | null = null;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function bars(seed: string, n: number) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: n }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) + i;
    const r = ((h >>> 0) % 1000) / 1000;
    const shape = Math.sin((i / n) * Math.PI) * 0.5 + 0.5;
    return 0.25 + 0.75 * (0.45 * r + 0.55 * shape * r + 0.15);
  });
}

export function VoiceSamplePlayer({ sample, compact = false, showTranscript = false, className }: {
  sample: VoiceSample; compact?: boolean; showTranscript?: boolean; className?: string;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(sample.durationS ?? 0);
  const heights = useMemo(() => bars(sample.id, compact ? 28 : 44), [sample.id, compact]);

  useEffect(() => () => { audio.current?.pause(); }, []);

  function toggle() {
    if (!audio.current) {
      const a = new Audio(sample.url);
      a.preload = "auto";
      a.addEventListener("loadedmetadata", () => Number.isFinite(a.duration) && setDuration(a.duration));
      a.addEventListener("timeupdate", () => a.duration && setProgress(a.currentTime / a.duration));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
      audio.current = a;
    }
    const a = audio.current;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      void a.play();
    } else a.pause();
  }

  const lit = Math.round(progress * heights.length);
  return (
    <div className={cn("rounded-xl border bg-muted/40 p-3", className)}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} ${sample.title}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-85">
          {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <div className="min-w-0 shrink-0">
          <p className="truncate text-sm font-medium">{sample.title}</p>
          <p className="text-xs text-muted-foreground">{duration ? fmt(playing ? progress * duration : duration) : "Voice sample"}{sample.aiVoice && " · AI demo voice"}</p>
        </div>
        <div className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden>
          {heights.map((v, i) => (
            <span key={i} className={cn("w-[3px] shrink-0 rounded-full transition-colors", i < lit ? "bg-emerald-500" : "bg-foreground/25")} style={{ height: `${Math.round(v * 100)}%` }} />
          ))}
        </div>
      </div>
      {showTranscript && sample.transcript && <p className="mt-2 text-sm text-muted-foreground">&ldquo;{sample.transcript}&rdquo;</p>}
    </div>
  );
}
