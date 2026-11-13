"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2, Ban, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceSamplePlayer } from "@/components/live-agents/voice-sample";
import { resolveLiveAgentReport, reviewLiveAgent } from "@/lib/admin/actions/live-agents";

export type AdminClip = { id: string; title: string; transcript: string | null; url: string; duration_s: number | null; status: string; ai_voice: boolean };

// Approve / send back / suspend a profile, and approve or reject each clip.
export function ProfileDecision({ id, status, canManage }: { id: string; status: string; canManage: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>();
  const [pending, start] = useTransition();
  if (!canManage) return null;
  const run = (decision: "approve" | "return" | "suspend" | "restore") => start(async () => {
    setMsg(undefined);
    const r = await reviewLiveAgent(id, decision, decision === "return" || decision === "suspend" ? note : undefined);
    setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Saved." });
    if (!r.error) { setReturning(false); setNote(""); router.refresh(); }
  });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && <Button size="sm" disabled={pending} onClick={() => run("approve")}><Check /> Approve and go live</Button>}
        {["pending", "live", "paused"].includes(status) && <Button size="sm" variant="outline" disabled={pending} onClick={() => setReturning((v) => !v)}><Undo2 /> Send back</Button>}
        {status !== "suspended" && <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run("suspend")}><Ban /> Suspend</Button>}
        {status === "suspended" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run("restore")}><RotateCcw /> Restore</Button>}
      </div>
      {returning && (
        <div className="space-y-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What should they change? They'll see this note." />
          <Button size="sm" disabled={pending || !note.trim()} onClick={() => run("return")}>Send back with note</Button>
        </div>
      )}
      {msg && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}
    </div>
  );
}

export function ClipReview({ clip, canManage }: { clip: AdminClip; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (decision: "approve_clip" | "reject_clip") => start(async () => {
    setError(undefined);
    const r = await reviewLiveAgent(clip.id, decision);
    if (r.error) setError(r.error); else router.refresh();
  });
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={clip.status === "approved" ? "success" : clip.status === "rejected" ? "destructive" : "secondary"}>{clip.status === "pending" ? "Needs review" : clip.status}</Badge>
        {canManage && clip.status !== "approved" && <Button size="xs" variant="outline" disabled={pending} onClick={() => run("approve_clip")}><Check /> Approve</Button>}
        {canManage && clip.status !== "rejected" && <Button size="xs" variant="ghost" disabled={pending} onClick={() => run("reject_clip")}><X /> Reject</Button>}
      </div>
      <VoiceSamplePlayer sample={{ id: clip.id, title: clip.title, transcript: clip.transcript, url: clip.url, durationS: clip.duration_s, featured: false, aiVoice: clip.ai_voice }} showTranscript />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ResolveReport({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await resolveLiveAgentReport(id); router.refresh(); })}><Check /> Mark resolved</Button>;
}
