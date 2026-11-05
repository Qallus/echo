"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, BookOpen, History, Info, Mail, MessageCircleReply, MessageSquare, Phone, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dismissSuggestion, sendSuggestion, startMirror, stopMirror, type LiveSuggestion } from "@/lib/redial/actions";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";

const KIND = {
  say: { icon: MessageCircleReply, label: "Say" }, answer: { icon: Sparkles, label: "Answer" }, info: { icon: Info, label: "Info" },
  caution: { icon: AlertTriangle, label: "Careful" }, sms: { icon: MessageSquare, label: "Text" }, email: { icon: Mail, label: "Email" },
} as const;
const SOURCE: Record<string, { icon: typeof Info; label: string }> = {
  call: { icon: Phone, label: "This call" }, knowledge: { icon: BookOpen, label: "Your notes" },
  history: { icon: History, label: "Earlier call" }, directory: { icon: Phone, label: "Directory" },
};

// Mirror on the live card: on/off, then suggestions as they come (newest
// first) with where each came from, and drafted texts or emails that only
// go out after the person reviews them and presses Send.
export function MirrorPanel({ callId, callerNumber, mirror, suggestions }: {
  callId: string; callerNumber: string | null; mirror: { state: string; error: string | null } | null; suggestions: LiveSuggestion[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const on = mirror?.state === "starting" || mirror?.state === "running";
  const shown = suggestions.filter((s) => s.status !== "dismissed");
  const toggle = () => start(async () => { setError(null); const r = on ? await stopMirror(callId) : await startMirror(callId); if (r.error) setError(r.error); });

  return (
    <section className="space-y-2 rounded-lg border bg-card p-3" aria-label={FEATURES.mirror.name}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium"><Sparkles className="size-3.5" /> {FEATURES.mirror.name}</h3>
        <span className="text-xs text-muted-foreground">
          {mirror?.state === "running" ? "Listening silently. The caller can't hear it." : mirror?.state === "starting" ? "Starting…"
            : mirror?.state === "failed" ? "Couldn't listen to this call." : "Off for this call."}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant={on ? "ghost" : "outline"} disabled={pending} onClick={toggle}>{on ? "Stop" : `Start ${FEATURES.mirror.name}`}</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {on && shown.length === 0 && <p className="text-xs text-muted-foreground">Suggestions appear here as the conversation goes.</p>}
      {shown.length > 0 && (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {shown.map((s) => (s.kind === "sms" || s.kind === "email" ? <Draft key={s.id} s={s} callerNumber={callerNumber} /> : <Tip key={s.id} s={s} />))}
        </ul>
      )}
    </section>
  );
}

function Tip({ s }: { s: LiveSuggestion }) {
  const [pending, start] = useTransition();
  const K = KIND[s.kind];
  const src = s.source ? SOURCE[s.source] : null;
  return (
    <li className={cn("rounded-lg border p-2.5 text-sm", s.kind === "caution" && "border-amber-500/40 bg-amber-500/5")}>
      <div className="flex items-start gap-2">
        <K.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label={K.label} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{s.title}</p>
          <p className="text-muted-foreground">{s.body}</p>
          {src && <span className="mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] text-muted-foreground"><src.icon className="size-2.5" />{src.label}</span>}
        </div>
        <button type="button" aria-label="Dismiss" disabled={pending} onClick={() => start(async () => { await dismissSuggestion(s.id); })}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
      </div>
    </li>
  );
}

// A drafted text or email: editable, and sent only when the person presses Send.
function Draft({ s, callerNumber }: { s: LiveSuggestion; callerNumber: string | null }) {
  const sms = s.kind === "sms";
  const [to, setTo] = useState(s.sent_to ?? (sms ? callerNumber ?? "" : ""));
  const [subject, setSubject] = useState(s.subject ?? "");
  const [body, setBody] = useState(s.body);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const K = KIND[s.kind];
  if (s.status === "sent") {
    return <li className="rounded-lg border p-2.5 text-xs text-muted-foreground"><K.icon className="mr-1 inline size-3.5" />{sms ? "Text" : "Email"} sent to {s.sent_to}: {s.title}</li>;
  }
  return (
    <li className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
      <div className="flex items-start gap-2">
        <K.icon className="mt-0.5 size-3.5 shrink-0" />
        <p className="min-w-0 flex-1 font-medium">{s.title} <span className="font-normal text-muted-foreground">· review before sending</span></p>
        <button type="button" aria-label="Dismiss" disabled={pending} onClick={() => start(async () => { await dismissSuggestion(s.id); })}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
      </div>
      <label className="block space-y-1"><span className="text-xs text-muted-foreground">To</span>
        <Input value={to} onChange={(e) => setTo(e.target.value)} type={sms ? "tel" : "email"} placeholder={sms ? "Their mobile number" : "Their email address"} /></label>
      {!sms && <label className="block space-y-1"><span className="text-xs text-muted-foreground">Subject</span><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></label>}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={sms ? 3 : 5} maxLength={1600} aria-label="Message" />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending || !to.trim() || !body.trim()}
          onClick={() => start(async () => setResult(await sendSuggestion(s.id, { to, subject, body })))}>{pending ? "Sending…" : `Send ${sms ? "text" : "email"}`}</Button>
        {s.status === "failed" && !result.ok && <span className="text-xs text-destructive">The last try didn&apos;t send.</span>}
        {(result.ok || result.error) && <span className={result.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{result.error ?? result.ok}</span>}
      </div>
    </li>
  );
}
