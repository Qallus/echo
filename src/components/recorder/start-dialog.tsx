"use client";

import { useState } from "react";
import { Mic, MonitorSpeaker, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RecordingSource } from "@/lib/types";
import type { CaptureMode } from "@/lib/recorder/media";
import { cn } from "@/lib/utils";
import { useRecorder } from "./recorder-provider";
import { WorkspacePicker } from "./workspace-picker";

const LABEL: Partial<Record<RecordingSource, string>> = { meeting: "Meeting", phone_call: "Call" };

function defaultTitle(source: RecordingSource) {
  const d = new Date();
  return `${LABEL[source] ?? "Recording"} ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// Asks where the recording goes before anything is captured, so it is never
// saved in the wrong workspace, even briefly.
export function StartDialog({ source, onClose }: { source: RecordingSource | null; onClose: () => void }) {
  return (
    <Dialog open={source !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {source && <StartForm key={source} source={source} onClose={onClose} />}
    </Dialog>
  );
}

function StartForm({ source, onClose }: { source: RecordingSource; onClose: () => void }) {
  const { workspaces, start } = useRecorder();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [title, setTitle] = useState(() => defaultTitle(source));
  const [mode, setMode] = useState<CaptureMode>("mic");
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const canShareTab = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
  // Phones and small tablets: a touch screen and no desktop-style screen sharing.
  const onPhone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches && !canShareTab;

  const go = async () => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return setError("Choose where to save this recording.");
    setStarting(true);
    setError(undefined);
    try {
      await start({ workspace, title: title.trim() || defaultTitle(source), source, mode });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError"
        ? "Echo needs permission to use your microphone. Allow it in the browser's address bar, then try again."
        : name === "NotFoundError" ? "No microphone was found." : e instanceof Error ? e.message : "Couldn't start recording.");
      setStarting(false);
    }
  };

  return (
    <DialogContent title={source === "phone_call" ? "Record a call" : "Record a meeting"}
      description="Choose where it's saved. You can take notes and flag moments while it records.">
      {source === "phone_call" && (
        <div className="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Recording a regular phone call?</p>
            <p className="text-muted-foreground">
              Echo records what your microphone hears, and a phone gives its microphone to the call. Put the call on
              <strong className="font-medium text-foreground"> speaker</strong> and record here on your computer or tablet, next to the phone.
              {onPhone && " Recording on the same phone as the call will capture silence."}
            </p>
          </div>
        </div>
      )}
      <WorkspacePicker workspaces={workspaces} value={workspaceId} onChange={setWorkspaceId} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
      </label>
      {canShareTab && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Audio</legend>
          {([
            ["mic", Mic, "Microphone", "In the room, or a call on speaker."],
            ["mic+tab", MonitorSpeaker, "Microphone + meeting audio", "Also records a Meet, Zoom or Teams tab you share."],
          ] as const).map(([value, Icon, label, hint]) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
              className={cn("flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/50", mode === value && "border-primary ring-1 ring-primary")}>
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
            </button>
          ))}
        </fieldset>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void go()} disabled={starting || !workspaceId}>{starting ? "Starting…" : "Start recording"}</Button>
      </div>
    </DialogContent>
  );
}
