"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleAlert, FileAudio, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fileDuration } from "@/lib/recorder/media";
import { ACCEPTED, isAcceptedFile, MAX_UPLOAD_BYTES, saveRecording } from "@/lib/recorder/save";
import { useRecorder } from "./recorder-provider";
import { WorkspacePicker } from "./workspace-picker";

type Item = { file: File; title: string; state: "ready" | "uploading" | "done" | "error"; message?: string; id?: string };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const titleFrom = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded audio";

function toItems(files: File[]): Item[] {
  return files.map((file) => {
    if (!isAcceptedFile(file)) return { file, title: titleFrom(file.name), state: "error", message: "Not an audio file." };
    if (file.size > MAX_UPLOAD_BYTES) return { file, title: titleFrom(file.name), state: "error", message: `Over the 50 MB limit (${mb(file.size)}).` };
    return { file, title: titleFrom(file.name), state: "ready" };
  });
}

// Upload one or more audio files into a chosen workspace.
export function UploadDialog({ files, userId, onClose }: { files: File[] | null; userId: string; onClose: () => void }) {
  return (
    <Dialog open={files !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {files && <UploadForm key={files.map((f) => f.name).join("|") || "empty"} initial={files} userId={userId} onClose={onClose} />}
    </Dialog>
  );
}

function UploadForm({ initial, userId, onClose }: { initial: File[]; userId: string; onClose: () => void }) {
  const router = useRouter();
  const { workspaces } = useRecorder();
  const [items, setItems] = useState<Item[]>(() => toItems(initial));
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const ready = items.filter((i) => i.state === "ready");
  const finished = items.length > 0 && items.every((i) => i.state === "done" || i.state === "error") && items.some((i) => i.state === "done");
  const update = (idx: number, patch: Partial<Item>) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const upload = async () => {
    if (!workspaceId) return;
    setBusy(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.state !== "ready") continue;
      update(i, { state: "uploading" });
      try {
        const id = await saveRecording({
          file: it.file, fileName: it.file.name, workspaceId, userId, title: it.title,
          source: "upload", durationSec: await fileDuration(it.file),
        });
        update(i, { state: "done", id });
      } catch (e) {
        update(i, { state: "error", message: e instanceof Error ? e.message : "Upload failed." });
      }
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <DialogContent title="Upload audio" description="Audio files up to 50 MB each (MP3, M4A, WAV, WebM, MP4…).">
      <input ref={picker} type="file" accept={ACCEPTED} multiple hidden
        onChange={(e) => { setItems((list) => [...list, ...toItems([...(e.target.files ?? [])])]); e.target.value = ""; }} />

      {items.length ? (
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {items.map((it, i) => (
            <li key={`${it.file.name}-${i}`} className="flex items-center gap-2 rounded-lg border p-2">
              {it.state === "uploading" ? <Loader2 className="size-4 shrink-0 animate-spin" />
                : it.state === "done" ? <CircleCheck className="size-4 shrink-0 text-sky-600" />
                : it.state === "error" ? <CircleAlert className="size-4 shrink-0 text-destructive" />
                : <FileAudio className="size-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                {it.state === "ready"
                  ? <Input value={it.title} onChange={(e) => update(i, { title: e.target.value })} maxLength={300} className="h-7" aria-label="Title" />
                  : <div className="truncate text-sm">{it.title}</div>}
                <div className="truncate text-xs text-muted-foreground">
                  {it.message ?? `${it.file.name} · ${mb(it.file.size)}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" onClick={() => picker.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="size-5" /> Choose audio files, or drop them anywhere in Echo
        </button>
      )}

      {!finished && <WorkspacePicker workspaces={workspaces} value={workspaceId} onChange={setWorkspaceId} />}

      <div className="flex items-center justify-between gap-2">
        {!finished && items.length > 0 ? <Button variant="ghost" size="sm" onClick={() => picker.current?.click()} disabled={busy}>Add files</Button> : <span />}
        {finished ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {items.filter((i) => i.id).length === 1 && (
              <Button onClick={() => { onClose(); router.push(`/recordings/${items.find((i) => i.id)!.id}`); }}>Open recording</Button>
            )}
          </div>
        ) : (
          <Button onClick={() => void upload()} disabled={busy || !workspaceId || !ready.length}>
            {busy ? "Uploading…" : ready.length > 1 ? `Upload ${ready.length} files` : "Upload"}
          </Button>
        )}
      </div>
    </DialogContent>
  );
}

// Full-window drop target: drag audio files from your computer anywhere onto Echo.
// Ignores in-app drags (moving recordings between workspaces), which carry no files.
export function UploadDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"));
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current++; setActive(true); };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setActive(false); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) onFiles(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [onFiles]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary px-16 py-12 text-center">
        <Upload className="size-8" />
        <p className="text-lg font-medium">Drop audio to upload</p>
        <p className="text-sm text-muted-foreground">You&apos;ll choose Business or Personal next.</p>
      </div>
    </div>
  );
}
