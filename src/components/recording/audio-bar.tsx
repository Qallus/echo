"use client";

import { useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/format";

// Plays the recording's audio from a signed Supabase Storage URL.
export function AudioBar({ duration, src }: { duration: number; src: string | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [rate, setRate] = useState(1);
  const [length, setLength] = useState(duration);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground">
        {failed ? "The audio couldn't be loaded. Refresh the page to try again." : "No audio file for this recording."}
      </div>
    );
  }

  const seek = (to: number) => {
    if (!audio.current) return;
    audio.current.currentTime = Math.min(length, Math.max(0, to));
  };
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  const cycleRate = () => {
    const next = rate >= 2 ? 1 : rate + 0.5;
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  return (
    <div className="flex items-center gap-3 border-t bg-background px-4 py-2">
      <audio ref={audio} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setLength(Math.round(e.currentTarget.duration)); }}
        onError={() => setFailed(true)} />
      <Button variant="ghost" size="icon-sm" onClick={() => seek(pos - 15)} aria-label="Back 15 seconds"><RotateCcw /></Button>
      <Button size="icon" className="rounded-full" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => seek(pos + 15)} aria-label="Forward 15 seconds"><RotateCw /></Button>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{formatClock(Math.floor(pos))}</span>
      <input
        type="range" min={0} max={length || 1} step={1} value={Math.floor(pos)}
        onChange={(e) => seek(Number(e.target.value))}
        className="h-1 flex-1 accent-primary" aria-label="Seek"
      />
      <span className="w-12 text-xs tabular-nums text-muted-foreground">{formatClock(length)}</span>
      <Button variant="ghost" size="sm" className="w-12 tabular-nums" onClick={cycleRate}>{rate}x</Button>
    </div>
  );
}
