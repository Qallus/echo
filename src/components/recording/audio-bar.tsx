"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/format";

// UI-only player for now. In a later step this wraps an <audio> element
// pointed at the recording's Supabase Storage signed URL.
export function AudioBar({ duration }: { duration: number }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos((p) => {
      if (p + rate >= duration) { setPlaying(false); return duration; }
      return p + rate;
    }), 1000);
    return () => clearInterval(t);
  }, [playing, rate, duration]);

  const seek = (d: number) => setPos((p) => Math.min(duration, Math.max(0, p + d)));

  return (
    <div className="flex items-center gap-3 border-t bg-background px-4 py-2">
      <Button variant="ghost" size="icon-sm" onClick={() => seek(-15)} aria-label="Back 15 seconds"><RotateCcw /></Button>
      <Button size="icon" className="rounded-full" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => seek(15)} aria-label="Forward 15 seconds"><RotateCw /></Button>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{formatClock(Math.floor(pos))}</span>
      <input
        type="range" min={0} max={duration} value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="h-1 flex-1 accent-primary" aria-label="Seek"
      />
      <span className="w-12 text-xs tabular-nums text-muted-foreground">{formatClock(duration)}</span>
      <Button variant="ghost" size="sm" className="w-12 tabular-nums" onClick={() => setRate((r) => (r >= 2 ? 1 : r + 0.5))}>
        {rate}x
      </Button>
    </div>
  );
}
