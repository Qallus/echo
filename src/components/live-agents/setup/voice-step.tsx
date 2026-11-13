"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AudioWaveform, Check, Mic, Pencil, RotateCcw, Square, Star, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { VoiceSamplePlayer } from "@/components/live-agents/voice-sample";
import { addVoiceClip, deleteVoiceClip, importStudioClip, markAgentStep, updateVoiceClip } from "@/lib/live-agents/agent-actions";
import { CLIP_IDEAS, CLIP_MAX_BYTES, CLIP_MAX_S, CLIP_MIN_S, CLIP_TYPES } from "@/lib/live-agents/setup";
import type { VoiceSample } from "@/lib/live-agents/types";
import { extensionFor, fileDuration, pickMimeType, readLevel, startCapture, type Capture } from "@/lib/recorder/media";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Field, StepFooter } from "./step-footer";

export type StudioClip = { id: string; name: string; duration: number };
type ClipStatus = "pending" | "approved" | "rejected";
const STATUS: Record<ClipStatus, { label: string; variant: "secondary" | "success" | "destructive" }> = {
  pending: { label: "In review", variant: "secondary" }, approved: { label: "Approved", variant: "success" }, rejected: { label: "Not approved", variant: "destructive" },
};
const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;
const baseType = (mime: string) => mime.split(";")[0];

// Step 6: up to three 15–30 second clips. Record in the browser, upload a
// file, or reuse a Recording Studio clip. Every clip is reviewed first.
export function VoiceStep({ userId, clips, clipStatus, studio }: { userId: string; clips: VoiceSample[]; clipStatus: Record<string, ClipStatus>; studio: StudioClip[] }) {
  const full = clips.length >= 3;
  const idea = CLIP_IDEAS[Math.min(clips.length, CLIP_IDEAS.length - 1)];
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Record up to 3 short clips, 15–{CLIP_MAX_S} seconds each, so businesses can hear your tone and clarity. Use a made-up business, and don&apos;t say your full name, number or email.
      </p>

      {clips.length > 0 && (
        <ul className="space-y-3">
          {clips.map((c) => <ClipRow key={c.id} clip={c} status={clipStatus[c.id] ?? "pending"} canFeature={clips.length > 1} />)}
        </ul>
      )}

      {full ? (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">You have 3 clips, the most a profile can show. Delete one to record another.</p>
      ) : (
        <Recorder key={clips.length} userId={userId} idea={idea} studio={studio} />
      )}

      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {["Find a quiet room and use a headset if you have one", "Smile while you talk: callers can hear it", "Clip 1: a greeting. Clip 2: a warm transfer. Clip 3: your choice", `MP3, M4A, WAV or WebM, up to ${CLIP_MAX_BYTES / 1024 / 1024} MB`].map((t) => (
          <li key={t} className="rounded-xl border p-3">{t}</li>
        ))}
      </ul>

      <StepFooter step={6} save={() => markAgentStep(6)} label={clips.length ? "Continue to rates" : "Skip for now"} />
    </div>
  );
}

function ClipRow({ clip, status, canFeature }: { clip: VoiceSample; status: ClipStatus; canFeature: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(clip.title);
  const [transcript, setTranscript] = useState(clip.transcript ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => {
    setError(undefined);
    const r = await fn();
    if (r.error) setError(r.error); else { setEditing(false); router.refresh(); }
  });
  return (
    <li className="space-y-2 rounded-2xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
        {clip.featured && <Badge variant="outline"><Star className="fill-current" /> Featured</Badge>}
        <div className="ml-auto flex gap-1">
          {canFeature && !clip.featured && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateVoiceClip(clip.id, { featured: true }))}><Star /> Feature</Button>}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing((e) => !e)}><Pencil /> Edit</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteVoiceClip(clip.id))} aria-label={`Delete ${clip.title}`}><Trash2 /></Button>
        </div>
      </div>
      <VoiceSamplePlayer sample={clip} showTranscript={!editing} />
      {editing && (
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="Clip title" />
          <Textarea rows={2} value={transcript} onChange={(e) => setTranscript(e.target.value)} maxLength={600} placeholder="What you say in this clip" aria-label="What you say" />
          <Button size="sm" disabled={pending} onClick={() => run(() => updateVoiceClip(clip.id, { title, transcript }))}><Check /> Save</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  );
}

type Take = { blob: Blob; url: string; duration: number; mime: string; ext: string };

function Recorder({ userId, idea, studio }: { userId: string; idea: (typeof CLIP_IDEAS)[number]; studio: StudioClip[] }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(40).fill(0.05));
  const [take, setTake] = useState<Take | null>(null);
  const [title, setTitle] = useState(idea.title === "Your choice" ? "" : idea.title);
  const [transcript, setTranscript] = useState("");
  const [studioId, setStudioId] = useState(studio[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const cap = useRef<Capture | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const cleanup = () => {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    cap.current?.stop();
    cap.current = null;
  };
  useEffect(() => () => { if (rec.current?.state === "recording") rec.current.stop(); cleanup(); }, []);
  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);

  async function record() {
    setError(undefined);
    try {
      const c = await startCapture("mic");
      cap.current = c;
      const mime = pickMimeType();
      const r = new MediaRecorder(c.stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      const began = performance.now();
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        const duration = Math.min(CLIP_MAX_S, (performance.now() - began) / 1000);
        const type = r.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type: baseType(type) });
        cleanup();
        if (duration < CLIP_MIN_S) { setState("idle"); setError(`That was under ${CLIP_MIN_S} seconds. Try a longer take.`); return; }
        setTake({ blob, url: URL.createObjectURL(blob), duration, mime: baseType(type), ext: extensionFor(type) });
        setState("done");
      };
      rec.current = r;
      r.start(250);
      setState("recording");
      const buf = new Uint8Array(c.analyser.fftSize);
      const tick = () => {
        const s = (performance.now() - began) / 1000;
        setElapsed(s);
        const lv = readLevel(c.analyser, buf);
        setLevels((l) => [...l.slice(1), Math.max(0.05, lv)]);
        if (s >= CLIP_MAX_S) { if (r.state === "recording") r.stop(); return; }
        timer.current = requestAnimationFrame(tick);
      };
      timer.current = requestAnimationFrame(tick);
    } catch (e) {
      cleanup();
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Allow microphone access in your browser to record." : "Couldn't start the microphone.");
    }
  }

  const stop = () => { if (rec.current?.state === "recording") rec.current.stop(); };
  const redo = () => { setTake(null); setElapsed(0); setLevels(Array(40).fill(0.05)); setState("idle"); };

  async function pickFile(file: File) {
    setError(undefined);
    const type = baseType(file.type || "");
    if (!CLIP_TYPES.includes(type)) return setError("Choose an MP3, M4A, WAV or WebM file.");
    if (file.size > CLIP_MAX_BYTES) return setError("That file is over 5 MB.");
    const duration = await fileDuration(file);
    if (!duration) return setError("Couldn't read how long that file is. Try an MP3 or WAV.");
    if (duration > CLIP_MAX_S) return setError(`That clip is ${duration} seconds. Trim it to ${CLIP_MAX_S} seconds or less.`);
    if (duration < CLIP_MIN_S) return setError(`That clip is under ${CLIP_MIN_S} seconds.`);
    const ext = (file.name.split(".").pop() ?? "mp3").toLowerCase().slice(0, 5);
    setTake({ blob: file, url: URL.createObjectURL(file), duration, mime: type, ext });
    setState("done");
  }

  const save = () => start(async () => {
    if (!take) return;
    setError(undefined);
    const supabase = createClient();
    const path = `${userId}/clips/${Date.now()}.${take.ext}`;
    const { error: up } = await supabase.storage.from("live-agent-media").upload(path, take.blob, { contentType: take.mime });
    if (up) return setError("Upload failed. Try again.");
    const r = await addVoiceClip({ path, title: title || idea.title, transcript, duration: take.duration });
    if (r.error) return setError(r.error);
    router.refresh();
  });

  const useStudio = () => start(async () => {
    setError(undefined);
    const r = await importStudioClip(studioId, title);
    if (r.error) setError(r.error); else router.refresh();
  });

  return (
    <div className="space-y-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">New clip{idea.title !== "Your choice" ? ` · ${idea.title}` : ""}</p>
        {state === "recording" && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive"><span className="size-2 animate-pulse rounded-full bg-destructive" /> Recording</span>}
      </div>
      <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Suggested script:</span> {idea.script}</p>

      {state !== "done" ? (
        <>
          <div className="flex h-14 items-center gap-[3px]" aria-hidden>
            {levels.map((v, i) => <span key={i} className={cn("w-full rounded-full", state === "recording" ? "bg-foreground/70" : "bg-foreground/15")} style={{ height: `${Math.round(v * 100)}%` }} />)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-sm tabular-nums">{fmt(elapsed)} / {fmt(CLIP_MAX_S)}</span>
            {state === "recording"
              ? <Button variant="destructive" onClick={stop}><Square className="fill-current" /> Stop</Button>
              : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => fileInput.current?.click()}><Upload /> Upload a file</Button>
                  <Button onClick={record}><Mic /> Start recording</Button>
                </div>
              )}
          </div>
          <input ref={fileInput} type="file" accept=".mp3,.m4a,.wav,.webm,.ogg,audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = ""; }} />
        </>
      ) : take && (
        <div className="space-y-3">
          <audio src={take.url} controls className="w-full" />
          <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Greeting" /></Field>
            <Field label="What you say (optional)" hint="Shown under the clip so businesses can follow along."><Textarea rows={2} value={transcript} onChange={(e) => setTranscript(e.target.value)} maxLength={600} /></Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={redo}><RotateCcw /> Start over</Button>
            <Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save clip"}</Button>
          </div>
        </div>
      )}

      {studio.length > 0 && state === "idle" && (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
          <Field label="Or use a recording from your Recording Studio" className="block min-w-0 flex-1 space-y-1.5">
            <Pick label="Studio recording" value={studioId} onChange={setStudioId} options={studio.map((s) => ({ value: s.id, label: `${s.name} (${Math.round(s.duration)} s)` }))} />
          </Field>
          <Button variant="outline" disabled={pending || !studioId} onClick={useStudio}><AudioWaveform /> Use this recording</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
