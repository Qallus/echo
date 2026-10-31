"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Starts transcription for a recording (runs on the server in the background).
export async function requestTranscription(recordingId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/transcribe", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordingId }), keepalive: true,
    });
    if (res.ok) return null;
    return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't start transcription.";
  } catch {
    return "Couldn't reach Echo to start transcription.";
  }
}

export function TranscribeButton({ recordingId, label = "Transcribe", variant = "default" }: {
  recordingId: string; label?: string; variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="sm" variant={variant} disabled={pending} onClick={() => start(async () => {
        const err = await requestTranscription(recordingId);
        setError(err);
        if (!err) router.refresh();
      })}>
        {variant === "outline" ? <RotateCcw /> : <Wand2 />} {pending ? "Starting…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Shown while a transcription job runs; refreshes the page until it's done.
export function Transcribing() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      <p className="font-medium text-foreground">Transcribing…</p>
      <p>This usually takes a minute or two. You can leave this page.</p>
    </div>
  );
}

export function TranscriptionFailed({ recordingId, message }: { recordingId: string; message: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center text-sm">
      <CircleAlert className="size-5 text-destructive" />
      <p className="font-medium">Transcription didn&apos;t work</p>
      {message && <p className="max-w-md text-muted-foreground">{message}</p>}
      <TranscribeButton recordingId={recordingId} label="Try again" variant="outline" />
    </div>
  );
}
