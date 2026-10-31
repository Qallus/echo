"use client";

import { useEffect, useRef, useState } from "react";
import {
  AudioLines, Briefcase, ChevronLeft, ChevronRight, Download, Flag, Loader2, Lock, Maximize2, Minus, Pause,
  PictureInPicture2, Play, RotateCcw, Square, SquarePen, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, spaceLabel } from "@/lib/format";
import { readLevel } from "@/lib/recorder/media";
import { cn } from "@/lib/utils";
import { useRecorder } from "./recorder-provider";

const TIPS_KEY = "echo.recorderTips.v1";
const TIPS = [
  { title: "Capture ideas as they come", body: "Type a quick note and press Enter. It's saved as a highlight at this moment in the recording." },
  { title: "Flag a moment", body: "No time to type? Tap the flag to mark this point. Add words later from the recording page." },
  { title: "Pause or stop anytime", body: "Pause for side conversations. Stop saves the recording and opens it." },
  { title: "Saved where you chose", body: "The header shows where this recording goes: your team's Business workspace or your private Personal one." },
];

// The in-call panel. Docked bottom-right in Echo, or inside the always-on-top
// pop-out window (Document Picture-in-Picture) where the browser supports it.
export function RecorderPanel({ inPip = false }: { inPip?: boolean }) {
  const r = useRecorder();
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState("");
  // First-run tips (the panel only ever renders in the browser, so localStorage is safe here).
  const [tip, setTip] = useState<number | null>(() => { try { return localStorage.getItem(TIPS_KEY) ? null : 0; } catch { return null; } });
  const list = useRef<HTMLOListElement>(null);

  const closeTips = () => { setTip(null); try { localStorage.setItem(TIPS_KEY, "1"); } catch {} };

  useEffect(() => { list.current?.lastElementChild?.scrollIntoView({ block: "nearest" }); }, [r.notes.length]);

  if (!r.session) return null;
  const ws = r.session.workspace;
  const recording = r.status === "recording" || r.status === "paused";

  if (!inPip && r.inPip) {
    return (
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm shadow-lg">
        <span className="size-2 animate-pulse rounded-full bg-red-500" /> Recording in the pop-out window · {formatClock(r.elapsed)}
      </div>
    );
  }

  if (!inPip && minimized) {
    return (
      <button onClick={() => setMinimized(false)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm shadow-lg hover:bg-muted">
        <span className={cn("size-2 rounded-full bg-red-500", r.status === "recording" && "animate-pulse")} />
        {r.status === "paused" ? "Paused" : "Recording"} · {formatClock(r.elapsed)}
        <Maximize2 className="size-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col bg-background text-foreground",
      inPip ? "h-svh" : "fixed right-4 bottom-4 z-40 h-[30rem] w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border shadow-xl")}>
      {/* Header: where this recording will be saved */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <AudioLines className="size-4" />
        <span className={cn("flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium", tip === 3 && "ring-2 ring-primary")}>
          {ws.isPersonal ? <Lock className="size-3 shrink-0" /> : <Briefcase className="size-3 shrink-0" />}
          <span className="truncate">{ws.isPersonal ? "Personal" : `Business · ${spaceLabel(ws)}`}</span>
        </span>
        <span className="ml-auto" />
        {!inPip && r.pipSupported && recording && (
          <Button variant="ghost" size="icon-sm" aria-label="Pop out (stays on top of other windows)" title="Pop out" onClick={() => void r.popOut()}>
            <PictureInPicture2 />
          </Button>
        )}
        {!inPip && <Button variant="ghost" size="icon-sm" aria-label="Minimize" onClick={() => setMinimized(true)}><Minus /></Button>}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div>
          <h2 className="text-lg text-muted-foreground">Meeting highlights</h2>
          <p className="truncate text-xs text-muted-foreground">{r.session.title}</p>
        </div>

        {recording && (
          <form className={cn("flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5", tip === 0 && "ring-2 ring-primary")}
            onSubmit={(e) => { e.preventDefault(); r.addNote(draft); setDraft(""); }}>
            <SquarePen className="size-4 shrink-0 text-muted-foreground" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000}
              placeholder="Jot down key points or ideas instantly" aria-label="Add a note"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </form>
        )}

        <ol ref={list} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto text-sm">
          {r.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-11 shrink-0 tabular-nums text-xs leading-5 text-muted-foreground">{formatClock(n.startSec)}</span>
              {n.flag ? <span className="flex items-center gap-1 text-muted-foreground"><Flag className="size-3.5" /> Flagged moment</span> : <span>{n.text}</span>}
            </li>
          ))}
          {!r.notes.length && recording && <li className="text-xs text-muted-foreground">Notes and flags you add appear here.</li>}
        </ol>

        {r.status === "saving" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Saving to {spaceLabel(ws)}…</p>
        )}
        {r.status === "failed" && (
          <div className="space-y-2 rounded-lg border border-destructive/40 p-2.5 text-sm">
            <p className="text-destructive">{r.error}</p>
            <p className="text-xs text-muted-foreground">Your audio is still here. Try again, or download it so nothing is lost.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={r.retrySave}><RotateCcw /> Try again</Button>
              <Button size="sm" variant="outline" onClick={r.downloadAudio}><Download /> Download</Button>
              <Button size="sm" variant="ghost" onClick={r.discard}><Trash2 /> Discard</Button>
            </div>
          </div>
        )}

        {tip !== null && recording && (
          <div role="dialog" aria-label="Recorder tips" className="absolute inset-x-3 top-24 z-10 space-y-2 rounded-xl border bg-background p-4 shadow-lg">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              {tip + 1} OF {TIPS.length}
              <button aria-label="Close tips" onClick={closeTips} className="hover:text-foreground"><X className="size-4" /></button>
            </div>
            <p className="font-medium">{TIPS[tip].title}</p>
            <p className="text-sm text-muted-foreground">{TIPS[tip].body}</p>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Previous tip" disabled={tip === 0} onClick={() => setTip(tip - 1)}><ChevronLeft /></Button>
              {tip < TIPS.length - 1
                ? <Button variant="ghost" size="icon-sm" aria-label="Next tip" onClick={() => setTip(tip + 1)}><ChevronRight /></Button>
                : <Button size="sm" onClick={closeTips}>Got it</Button>}
            </div>
          </div>
        )}
      </div>

      {recording && (
        <div className={cn("flex items-center gap-2 border-t p-3", tip === 2 && "ring-2 ring-inset ring-primary")}>
          {r.status === "paused"
            ? <Button variant="outline" size="icon-lg" aria-label="Resume" onClick={r.resume}><Play /></Button>
            : <Button variant="outline" size="icon-lg" aria-label="Pause" onClick={r.pause}><Pause /></Button>}
          <Button variant="outline" size="icon-lg" aria-label="Stop and save" onClick={r.stop}><Square className="fill-current" /></Button>
          <div className="flex flex-1 items-center justify-center gap-2 text-sm tabular-nums text-muted-foreground">
            <LevelMeter analyser={r.status === "recording" ? r.analyser : null} />
            {formatClock(r.elapsed)}
          </div>
          <Button variant="outline" size="icon-lg" aria-label="Flag this moment" onClick={r.flag}
            className={cn(tip === 1 && "ring-2 ring-primary")}><Flag /></Button>
        </div>
      )}
    </div>
  );
}

// Five bars that follow the input level.
function LevelMeter({ analyser }: { analyser: AnalyserNode | null }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => { setLevel(readLevel(analyser, buf)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {[0.2, 0.4, 0.6, 0.8, 1].map((t) => (
        <span key={t} className={cn("w-0.5 rounded-full bg-muted-foreground/30", analyser && level >= t * 0.8 && "bg-foreground")}
          style={{ height: `${30 + t * 70}%` }} />
      ))}
    </span>
  );
}
