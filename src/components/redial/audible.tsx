"use client";

import { useState, useTransition } from "react";
import { Check, Clock, MessageSquareLock, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { directAgent, type LiveDirection } from "@/lib/redial/actions";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Ask which project they're calling about.",
  "Get their email address.",
  "Tell them I'll call back today.",
  "Wrap up the call politely.",
];

// Audible: type private directions to the assistant while it's on the call.
// The caller never hears them. Status is what the gateway reported:
// waiting for a pause, delivered (the assistant has it, which isn't the same
// as following it), or not delivered.
export function Audible({ callId, assistant, directions }: { callId: string; assistant: string; directions: LiveDirection[] }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (value: string) => {
    const t = value.trim();
    if (!t || pending) return;
    setError(null);
    start(async () => {
      const r = await directAgent(callId, t);
      if (r.error) setError(r.error); else setText("");
    });
  };

  return (
    <section className="space-y-2 rounded-lg border bg-card p-3" aria-label={`${FEATURES.audible.name}: private directions`}>
      <h3 className="flex items-center gap-1.5 text-xs font-medium"><MessageSquareLock className="size-3.5" /> Guide {assistant} privately <span className="font-normal text-muted-foreground">· the caller can&apos;t hear this</span></h3>
      {directions.length > 0 && (
        <ol className="space-y-1 text-sm">
          {directions.map((d) => (
            <li key={d.id} className="flex items-start gap-2">
              <span className="min-w-0 flex-1">{d.text}{!d.mine && <span className="text-xs text-muted-foreground"> · from a team member</span>}</span>
              <Status status={d.status} assistant={assistant} />
            </li>
          ))}
        </ol>
      )}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor={`direct-${callId}`} className="sr-only">Private direction for {assistant}</label>
        <Textarea id={`direct-${callId}`} rows={1} maxLength={500} value={text} disabled={pending} placeholder={`e.g. Ask when they need it done`}
          className="min-h-9 resize-none" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="Send to the assistant"><SendHorizontal /></Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" disabled={pending} onClick={() => send(s)}
            className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">{s}</button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}

function Status({ status, assistant }: { status: LiveDirection["status"]; assistant: string }) {
  const [Icon, label, tone] = status === "delivered" ? [Check, `Delivered to ${assistant}`, "text-emerald-700 dark:text-emerald-300"]
    : status === "failed" ? [X, "Not delivered", "text-destructive"] : [Clock, "Waiting for a pause", "text-muted-foreground"];
  return <span className={cn("flex shrink-0 items-center gap-1 text-[11px]", tone)}><Icon className="size-3" />{label}</span>;
}
