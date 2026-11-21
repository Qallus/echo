"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { runVisibilityNow, saveVisibilitySettings, stepVisibilityRun, syncSearchConsoleNow } from "@/lib/admin/actions/analytics";

export function SyncButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <span className="ml-auto flex items-center gap-2">
      {(msg.ok || msg.error) && <span className={msg.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{msg.error ?? msg.ok}</span>}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { setMsg(await syncSearchConsoleNow()); router.refresh(); })}>
        <RefreshCw className={pending ? "animate-spin" : undefined} /> {pending ? "Syncing…" : "Sync now"}
      </Button>
    </span>
  );
}

// The AI visibility check: edit the questions and competitors, or run it now.
export function VisibilityControls({ questions, competitors, running }: { questions: string[]; competitors: string[]; running: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(questions.join("\n"));
  const [c, setC] = useState(competitors.join(", "));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);

  const drive = async (runId: string) => {
    busy.current = true;
    for (;;) {
      const p = await stepVisibilityRun(runId);
      setProgress({ done: p.done, total: p.total });
      if (p.finished) break;
    }
    busy.current = false;
    setProgress(null);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {progress && <span className="text-xs text-muted-foreground tabular-nums">Asking AI assistants… {progress.done} of {progress.total}</span>}
      {msg.error && <span className="text-xs text-destructive">{msg.error}</span>}
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Settings2 /> Questions</Button>
      <Button size="sm" disabled={pending || Boolean(progress)} onClick={() => start(async () => {
        setMsg({});
        if (running) { void drive(running); return; }
        const r = await runVisibilityNow();
        if (r.error || !r.runId) setMsg({ error: r.error }); else void drive(r.runId);
      })}><Play /> {running ? "Finish the current check" : "Run the check now"}</Button>
      {open && (
        <ResponsivePanel open onOpenChange={(o) => !o && setOpen(false)} title="AI visibility check" id="ai-visibility" defaultWidth={560}
          description="Each AI assistant is asked these questions once a month. Write them the way your customers would ask."
          footer={
            <div className="flex items-center justify-end gap-2">
              {(msg.ok || msg.error) && <span className={msg.error ? "mr-auto text-sm text-destructive" : "mr-auto text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</span>}
              <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
              <Button disabled={pending} onClick={() => start(async () => {
                const r = await saveVisibilitySettings({ questions: q.split("\n").map((x) => x.trim()).filter(Boolean), competitors: c.split(",").map((x) => x.trim()).filter(Boolean) });
                setMsg(r); if (r.ok) router.refresh();
              })}>Save</Button>
            </div>
          }>
          <div className="space-y-1.5">
            <Label htmlFor="av-q">Questions (one per line, up to 30)</Label>
            <Textarea id="av-q" rows={10} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-c">Competitors to watch (comma separated)</Label>
            <Textarea id="av-c" rows={4} value={c} onChange={(e) => setC(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Uses Redial&apos;s own AI keys (ChatGPT, Claude, Gemini, Grok, and Perplexity through OpenRouter). About a few cents a run.</p>
        </ResponsivePanel>
      )}
    </div>
  );
}
