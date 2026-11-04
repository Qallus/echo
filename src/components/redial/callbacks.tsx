"use client";

import { useState, useTransition } from "react";
import { Check, Phone, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCallback, deleteCallback, setCallbackDone } from "@/lib/redial/actions";
import type { Call, Callback, Line } from "@/lib/redial/types";
import { cn } from "@/lib/utils";

const pretty = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "");
const when = (c: Callback) => new Date(c.due_at).toLocaleString([], { timeZone: c.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Callback reminders: a list of people to call back, with when and why.
export function Callbacks({ line, callbacks, calls }: { line: Line; callbacks: Callback[]; calls: Call[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => setError((await fn()).error ?? null));
  const open = callbacks.filter((c) => !c.done_at);
  const doneList = callbacks.filter((c) => c.done_at).slice(-20).reverse();
  const nowIso = new Date().toISOString();

  const row = (c: Callback) => {
    const call = calls.find((x) => x.id === c.call_id);
    const overdue = !c.done_at && c.due_at < nowIso;
    return (
      <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", c.done_at && "text-muted-foreground line-through")}>{c.name || pretty(c.number) || "Callback"}</p>
          <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>{when(c)}{overdue ? " · overdue" : ""}{c.note ? ` · ${c.note}` : call?.summary ? ` · ${call.summary}` : ""}</p>
        </div>
        {c.number && !c.done_at && <Button size="sm" variant="outline" nativeButton={false} render={<a href={`tel:${c.number}`} />}><Phone /> Call</Button>}
        <Button size="icon-sm" variant="ghost" aria-label={c.done_at ? "Reopen" : "Mark done"} disabled={pending} onClick={() => run(() => setCallbackDone(c.id, !c.done_at))}>{c.done_at ? <RotateCcw /> : <Check />}</Button>
        <Button size="icon-sm" variant="ghost" aria-label="Delete" disabled={pending} onClick={() => run(() => deleteCallback(c.id))}><Trash2 /></Button>
      </li>
    );
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Reminders to call people back. They&apos;re reminders only; nothing is dialed for you.</p>
        <Button size="sm" onClick={() => setAdding(true)}><Plus /> Add</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {open.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No callbacks due. Use “Remind me” on a call to add one.</p>
        : <ul className="divide-y rounded-xl border bg-card">{open.map(row)}</ul>}
      {doneList.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Done ({doneList.length})</summary>
          <ul className="mt-2 divide-y rounded-xl border bg-card">{doneList.map(row)}</ul>
        </details>
      )}
      {adding && <CallbackDialog line={line} call={null} onClose={() => setAdding(false)} />}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function CallbackDialog({ line, call, onClose }: { line: Line; call: Call | null; onClose: () => void }) {
  const [due, setDue] = useState(() => { const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0); return localInput(d); });
  const [name, setName] = useState(call?.caller_name || call?.caller_id_name || "");
  const [number, setNumber] = useState(pretty(call?.callback_number || call?.from_number || null));
  const [note, setNote] = useState(call?.purpose ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Remind me to call back" description={`Times are in ${timezone.replace(/_/g, " ")}.`}>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addCallback({ lineId: line.id, callId: call?.id ?? null, name, number, due, timezone, note });
            if (r.error) setError(r.error); else onClose();
          });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="cb-name">Name</Label><Input id="cb-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="cb-num">Number</Label><Input id="cb-num" type="tel" value={number} onChange={(e) => setNumber(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="cb-due">When</Label><Input id="cb-due" type="datetime-local" value={due} required onChange={(e) => setDue(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="cb-note">Note</Label><Textarea id="cb-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
