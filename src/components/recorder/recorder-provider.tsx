"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { RecordingSource, Workspace } from "@/lib/types";
import { extensionFor, pickMimeType, startCapture, type Capture, type CaptureMode } from "@/lib/recorder/media";
import { saveRecording } from "@/lib/recorder/save";
import { requestTranscription } from "@/components/recording/transcribe";
import { RecorderPanel } from "./recorder-panel";
import { StartDialog } from "./start-dialog";
import { UploadDialog, UploadDropZone } from "./upload-dialog";

export type Note = { startSec: number; text: string; flag?: boolean };
export type Status = "idle" | "recording" | "paused" | "saving" | "failed";
export type Session = { workspace: Workspace; title: string; source: RecordingSource; startedAt: string };

type Ctx = {
  workspaces: Workspace[];
  status: Status;
  session: Session | null;
  notes: Note[];
  elapsed: number;
  error: string | null;
  analyser: AnalyserNode | null;
  pipSupported: boolean;
  inPip: boolean;
  openStart: (source: RecordingSource) => void;
  openUpload: (files?: File[]) => void;
  start: (opts: { workspace: Workspace; title: string; source: RecordingSource; mode: CaptureMode }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  addNote: (text: string) => void;
  flag: () => void;
  popOut: () => Promise<void>;
  retrySave: () => void;
  downloadAudio: () => void;
  discard: () => void;
};

const RecorderContext = createContext<Ctx | null>(null);
export const useRecorder = () => {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error("useRecorder must be used inside RecorderProvider");
  return ctx;
};

type PipWindow = Window & typeof globalThis;
type DocumentPiP = { requestWindow: (o: { width: number; height: number }) => Promise<PipWindow> };
const documentPiP = () => (typeof window !== "undefined" ? (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture : undefined);

// Copies the app's styles into the pop-out window so the panel looks the same.
function adoptStyles(pip: PipWindow) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const style = pip.document.createElement("style");
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      pip.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = pip.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        pip.document.head.appendChild(link);
      }
    }
  }
  pip.document.documentElement.className = document.documentElement.className;
  pip.document.body.className = `${document.body.className} bg-background`;
}

export function RecorderProvider({ workspaces, userId, children }: { workspaces: Workspace[]; userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [startSource, setStartSource] = useState<RecordingSource | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[] | null>(null);
  const [pip, setPip] = useState<PipWindow | null>(null);
  const [pipSupported, setPipSupported] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const capture = useRef<Capture | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const clock = useRef({ accumulated: 0, since: 0 }); // ms recorded before the current run, and when it started
  const notesRef = useRef<Note[]>([]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after hydration
  useEffect(() => setPipSupported(Boolean(documentPiP())), []);

  // Seconds recorded so far (excludes paused time). Reads refs only, so it's stable.
  const seconds = useCallback(() => (clock.current.accumulated + (clock.current.since ? Date.now() - clock.current.since : 0)) / 1000, []);

  // Timer
  useEffect(() => {
    if (status !== "recording") return;
    const t = setInterval(() => setElapsed(Math.floor(seconds())), 250);
    return () => clearInterval(t);
  }, [status, seconds]);

  // Don't lose a recording to an accidental tab close.
  useEffect(() => {
    if (status === "idle") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const reset = useCallback(() => {
    capture.current?.stop();
    capture.current = null;
    recorder.current = null;
    chunks.current = [];
    blob.current = null;
    clock.current = { accumulated: 0, since: 0 };
    setAnalyser(null);
    setSession(null);
    setNotes([]);
    setElapsed(0);
    setError(null);
    setStatus("idle");
    pip?.close();
  }, [pip]);

  const save = useCallback(async (s: Session) => {
    if (!blob.current) return;
    setStatus("saving");
    setError(null);
    try {
      const mime = blob.current.type;
      const id = await saveRecording({
        file: blob.current, fileName: `recording.${extensionFor(mime)}`, workspaceId: s.workspace.id, userId,
        title: s.title, source: s.source, durationSec: Math.round(seconds()), createdAt: s.startedAt,
        highlights: notesRef.current.map((n) => ({ startSec: n.startSec, text: n.flag && !n.text ? "Flagged moment" : n.text })),
      });
      await requestTranscription(id); // starts in the background; the page shows progress
      reset();
      router.push(`/recordings/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the recording.");
      setStatus("failed");
    }
  }, [reset, router, userId, seconds]);

  const start: Ctx["start"] = async ({ workspace, title, source, mode }) => {
    const mimeType = pickMimeType();
    if (!mimeType) throw new Error("This browser can't record audio. Try Chrome, Edge, Firefox or Safari.");
    const cap = await startCapture(mode); // throws on denied permission
    // 32 kbps Opus is clear for speech and keeps ~1h40m under the 25 MB transcription limit.
    const rec = new MediaRecorder(cap.stream, { mimeType, audioBitsPerSecond: 32_000 });
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.start(1000);
    capture.current = cap;
    recorder.current = rec;
    clock.current = { accumulated: 0, since: Date.now() };
    setAnalyser(cap.analyser);
    setSession({ workspace, title, source, startedAt: new Date().toISOString() });
    setNotes([]);
    setElapsed(0);
    setStatus("recording");
    setStartSource(null);
  };

  const pause = () => {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    clock.current = { accumulated: clock.current.accumulated + Date.now() - clock.current.since, since: 0 };
    setStatus("paused");
  };
  const resume = () => {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    clock.current.since = Date.now();
    setStatus("recording");
  };

  const stop = () => {
    const rec = recorder.current;
    const s = session;
    if (!rec || !s) return;
    if (clock.current.since) clock.current = { accumulated: clock.current.accumulated + Date.now() - clock.current.since, since: 0 };
    rec.onstop = () => {
      blob.current = new Blob(chunks.current, { type: rec.mimeType });
      capture.current?.stop();
      setAnalyser(null);
      void save(s);
    };
    rec.stop();
  };

  const addNote = (text: string) => {
    const clean = text.trim();
    if (clean) setNotes((n) => [...n, { startSec: Math.floor(seconds()), text: clean }]);
  };
  const flag = () => setNotes((n) => [...n, { startSec: Math.floor(seconds()), text: "", flag: true }]);

  const popOut = async () => {
    const api = documentPiP();
    if (!api || pip) return;
    const w = await api.requestWindow({ width: 380, height: 520 });
    adoptStyles(w);
    w.document.title = "Echo recorder";
    w.addEventListener("pagehide", () => setPip(null));
    setPip(w);
  };

  const downloadAudio = () => {
    if (!blob.current || !session) return;
    const url = URL.createObjectURL(blob.current);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${session.title}.${extensionFor(blob.current.type)}` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const ctx: Ctx = {
    workspaces, status, session, notes, elapsed, error, analyser, pipSupported, inPip: Boolean(pip),
    openStart: (source) => { if (status === "idle") setStartSource(source); },
    openUpload: (files) => setUploadFiles(files ?? []),
    start, pause, resume, stop, addNote, flag, popOut,
    retrySave: () => { if (session) void save(session); },
    downloadAudio,
    discard: reset,
  };

  return (
    <RecorderContext.Provider value={ctx}>
      {children}
      {/* In Echo: the docked panel, or a "recording in the pop-out" pill while the pop-out is open. */}
      {status !== "idle" && <RecorderPanel />}
      {status !== "idle" && pip && createPortal(<RecorderPanel inPip />, pip.document.body)}
      <StartDialog source={startSource} onClose={() => setStartSource(null)} />
      <UploadDialog files={uploadFiles} userId={userId} onClose={() => setUploadFiles(null)} />
      <UploadDropZone onFiles={setUploadFiles} />
    </RecorderContext.Provider>
  );
}
