"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, PhoneCall, User } from "lucide-react";
import { liveCalls, type LiveCall } from "@/lib/redial/actions";
import type { Line } from "@/lib/redial/types";
import { cn } from "@/lib/utils";

const prettyNumber = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "No caller ID");
const IDLE_MS = 15000;
const LIVE_MS = 2500;

// Calls happening right now on this line: who's calling, what state the call
// is in and, with transcript access, what's being said. Read-only for now.
// Checks every 15 seconds, every 2.5 while a call is live, and not at all
// while the tab is hidden. When a call ends the page refreshes its inbox.
export function LiveCalls({ line, canReadTranscript }: { line: Line; canReadTranscript: boolean }) {
  const router = useRouter();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const liveIds = useRef<string>("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      let next: LiveCall[] = [];
      if (!document.hidden) {
        try { next = await liveCalls(line.id); } catch { next = []; }
        if (stopped) return;
        const ids = next.map((c) => c.id).join(",");
        if (liveIds.current && ids !== liveIds.current) router.refresh();
        liveIds.current = ids;
        setCalls(next);
      }
      timer = setTimeout(tick, next.length ? LIVE_MS : IDLE_MS);
    };
    void tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [line.id, router]);

  if (!calls.length) return null;
  return (
    <section aria-label="Live calls" className="space-y-3">
      {calls.map((c) => <LiveCard key={c.id} call={c} line={line} canReadTranscript={canReadTranscript} />)}
    </section>
  );
}

function LiveCard({ call: c, line, canReadTranscript }: { call: LiveCall; line: Line; canReadTranscript: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(c.started_at).getTime()) / 1000));
  const who = c.caller_name || c.caller_id_name || prettyNumber(c.from_number);
  const onCall = c.session?.participants.filter((p) => p.status === "joined") ?? [];

  return (
    <article className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <h2 className="text-sm font-semibold"><PhoneCall className="mr-1 inline size-4" />Live: {who}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        <span className="text-xs text-muted-foreground">· {stateLabel(c, line)}</span>
      </header>
      {onCall.length > 0 && (
        <p className="text-xs text-muted-foreground">
          On the call: {onCall.map((p) => (p.role === "agent" ? line.assistant_name : p.role === "caller" ? "Caller" : "Team member") + (p.muted ? " (muted)" : "")).join(", ")}
        </p>
      )}
      {canReadTranscript ? <LiveTranscript turns={c.turns} assistant={line.assistant_name} /> : (
        <p className="text-xs text-muted-foreground">The live transcript is only shown to people the owner lets read transcripts.</p>
      )}
    </article>
  );
}

function stateLabel(c: LiveCall, line: Line) {
  if (c.status === "connecting") return "Ringing you";
  if (c.status === "ringing") return "Ringing";
  const ai = c.session?.ai_state;
  if (ai === "pending" || ai === "joining") return `Connecting ${line.assistant_name}`;
  if (ai === "left" || ai === "failed") return "Wrapping up";
  return `${line.assistant_name} is talking with the caller`;
}

// The conversation so far, kept scrolled to the newest line unless the
// reader has scrolled up.
function LiveTranscript({ turns, assistant }: { turns: LiveCall["turns"]; assistant: string }) {
  const box = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);
  useEffect(() => { if (pinned.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [turns.length]);
  if (!turns.length) return <p className="text-xs text-muted-foreground">Waiting for the first words…</p>;
  return (
    <ol ref={box} aria-live="polite" onScroll={(e) => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
      className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
      {turns.map((t) => (
        <li key={t.id} className={cn("flex max-w-[85%] gap-2 rounded-lg px-3 py-2", t.role === "assistant" ? "bg-card" : "ml-auto bg-primary/10")}>
          {t.role === "assistant" ? <Bot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : <User className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
          <span><span className="block text-[10px] font-medium text-muted-foreground">{t.role === "assistant" ? assistant : "Caller"}</span>{t.text}</span>
        </li>
      ))}
    </ol>
  );
}
