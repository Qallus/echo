"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  downloadName = "audio",
  compact = false,
  className,
}: {
  src: string;
  downloadName?: string;
  compact?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }
  function seekTo(clientX: number) {
    const a = audioRef.current;
    const track = trackRef.current;
    if (!a || !track || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  }
  function changeVolume(v: number) {
    const a = audioRef.current;
    if (!a) return;
    a.volume = v;
    a.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  }
  function toggleMute() {
    const a = audioRef.current;
    if (!a) return;
    const next = !muted;
    a.muted = next;
    setMuted(next);
  }

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={trackRef}
          onClick={(e) => seekTo(e.clientX)}
          className="group relative h-1.5 cursor-pointer rounded-full bg-border"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {!compact && (
        <>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleMute} aria-label="Mute" className="text-muted-foreground hover:text-foreground">
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="hidden w-16 accent-primary sm:block"
              aria-label="Volume"
            />
          </div>
          <a
            href={src}
            download={downloadName}
            aria-label="Download"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Download className="h-4 w-4" />
          </a>
        </>
      )}
    </div>
  );
}
