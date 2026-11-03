"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { CalendarClock, Check, CheckSquare, ChevronRight, Mail, MessageSquare, Phone, Plus, Square, StickyNote, Trash2, Voicemail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addActivity, deleteActivity, setActivityDone } from "@/lib/admin/actions/crm";
import { logActivity } from "@/lib/admin/actions/crm-people";
import { formatDay, isOverdue, ownerName, today, type Activity, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { DetailRow, EmptyState, Panel } from "./crm-kit";
import { SELECT } from "./crm-ui";

const CHANNEL: Record<string, { label: string; icon: typeof Phone; tone: string }> = {
  call: { label: "Call", icon: Phone, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  sms: { label: "Text", icon: MessageSquare, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  email: { label: "Email", icon: Mail, tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  voicemail: { label: "Voicemail", icon: Voicemail, tone: "bg-muted text-muted-foreground" },
  meeting: { label: "Meeting", icon: CalendarClock, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  note: { label: "Note", icon: StickyNote, tone: "bg-muted text-muted-foreground" },
  task: { label: "Task", icon: Check, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

const TABS: { key: string; label: string; kinds: string[] | null; log: LogKind | null }[] = [
  { key: "all", label: "All", kinds: null, log: null },
  { key: "call", label: "Calls", kinds: ["call", "voicemail"], log: "call" },
  { key: "email", label: "Email", kinds: ["email"], log: "email" },
  { key: "sms", label: "Texts", kinds: ["sms"], log: "sms" },
  { key: "note", label: "Notes", kinds: ["note"], log: "note" },
  { key: "meeting", label: "Meetings", kinds: ["meeting"], log: "meeting" },
  { key: "task", label: "Tasks", kinds: ["task"], log: "task" },
];

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const duration = (s: number | null) => (s ? (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`) : null);

type Target = { company_id?: string; contact_id?: string; deal_id?: string };

// Which tabs this browser has looked at, kept in localStorage.
const subscribeStorage = (cb: () => void) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); };
const readStorage = (key: string) => { try { return localStorage.getItem(key) ?? "{}"; } catch { return "{}"; } };
const parseSeen = (raw: string): Record<string, string> => { try { return JSON.parse(raw); } catch { return {}; } };

// One stream for everything that happened on a record. Tabs filter by channel;
// a tab's count is highlighted until it's been looked at (per browser).
export function TimelinePanel({ activities, staff, target, readOnly, seenKey }: {
  activities: Activity[]; staff: StaffOption[]; target: Target; readOnly: boolean; seenKey: string;
}) {
  const [tab, setTab] = useState("all");
  const [openItem, setOpenItem] = useState<Activity | null>(null);
  const [log, setLog] = useState<LogKind | "pick" | null>(null);
  const [pending, start] = useTransition();
  const storageKey = `echo:timeline-seen:${seenKey}`;
  const stored = useSyncExternalStore(subscribeStorage, () => readStorage(storageKey), () => "{}");
  const [marked, setMarked] = useState<Record<string, string> | null>(null);
  const seen = useMemo(() => marked ?? parseSeen(stored), [marked, stored]);

  const active = TABS.find((t) => t.key === tab)!;
  const shown = useMemo(() => (active.kinds ? activities.filter((a) => active.kinds!.includes(a.kind)) : activities), [activities, active]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => {
    const rows = t.kinds ? activities.filter((a) => t.kinds!.includes(a.kind)) : activities;
    const mark = seen[t.key];
    return [t.key, { total: rows.length, unseen: mark ? rows.filter((a) => a.occurred_at > mark).length : rows.length }];
  })), [activities, seen]);

  const openTab = (key: string) => {
    setTab(key);
    const now = new Date().toISOString();
    const next = { ...seen, [key]: now, ...(key === "all" ? Object.fromEntries(TABS.map((t) => [t.key, now])) : {}) };
    setMarked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode */ }
  };

  return (
    <Panel title="Activity timeline" action={
      <div className="flex min-w-0 items-center gap-2">
        <div role="tablist" aria-label="Activity channels" className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => {
            const c = counts[t.key];
            return (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => openTab(t.key)}
                className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-1 text-xs font-medium transition-colors",
                  tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
                {c.total > 0 && (
                  <span className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                    c.unseen > 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{c.total}</span>
                )}
              </button>
            );
          })}
        </div>
        {!readOnly && <Button size="sm" variant="outline" className="shrink-0" onClick={() => setLog(active.log ?? "pick")}><Plus /> Add</Button>}
      </div>
    }>
      {shown.length === 0 ? (
        <EmptyState message={tab === "all" ? "No activity yet. Calls, texts and emails attach here automatically; add anything else." : `Nothing under ${active.label} yet.`} />
      ) : (
        <div className="space-y-2">
          {shown.map((a) => {
            const ch = CHANNEL[a.kind] ?? CHANNEL.note;
            const Icon = a.kind === "task" ? (a.done_at ? CheckSquare : Square) : ch.icon;
            const dir = a.direction === "inbound" ? "Inbound" : a.direction === "outbound" ? "Outbound" : null;
            const due = a.due_at?.slice(0, 10) ?? null;
            return (
              <div key={a.id} className="group flex items-start gap-2">
                {a.kind === "task" && !readOnly ? (
                  <button type="button" aria-label={a.done_at ? "Reopen task" : "Mark task done"} disabled={pending}
                    onClick={() => start(async () => { await setActivityDone(a.id, !a.done_at); })}
                    className={cn("mt-3 flex size-7 shrink-0 items-center justify-center rounded-full", ch.tone)}><Icon className="size-3.5" /></button>
                ) : null}
                <button type="button" onClick={() => setOpenItem(a)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40">
                  {!(a.kind === "task" && !readOnly) && <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", ch.tone)}><Icon className="size-3.5" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn("text-sm font-medium", a.done_at && "text-muted-foreground line-through")}>{dir ? `${dir} ${ch.label.toLowerCase()}` : ch.label}</span>
                      <span className="text-xs text-muted-foreground">{fmtWhen(a.occurred_at)}</span>
                      {duration(a.duration_seconds) && <span className="text-xs text-muted-foreground">· {duration(a.duration_seconds)}</span>}
                      {a.transcript && <Badge variant="outline" className="text-[10px]">Transcript</Badge>}
                      {due && !a.done_at && <span className={cn("text-xs", isOverdue(due) ? "font-medium text-destructive" : "text-muted-foreground")}>· Due {formatDay(due)}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{a.subject || a.body}</span>
                  </span>
                  <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground/50" />
                </button>
                {!readOnly && (
                  <Button variant="ghost" size="icon-xs" aria-label="Delete entry" disabled={pending} className="mt-3 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    onClick={() => confirm("Delete this entry?") && start(async () => { await deleteActivity(a.id); })}><Trash2 /></Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(openItem)} onOpenChange={(o) => !o && setOpenItem(null)}>
        {openItem && (
          <DialogContent title={`${(CHANNEL[openItem.kind] ?? CHANNEL.note).label} · ${fmtWhen(openItem.occurred_at)}`} className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
            <div className="grid gap-x-6 sm:grid-cols-2">
              <DetailRow label="Direction">{openItem.direction}</DetailRow>
              <DetailRow label="Status">{openItem.status ?? (openItem.kind === "task" ? (openItem.done_at ? "Done" : "Open") : null)}</DetailRow>
              <DetailRow label="From">{openItem.from_addr}</DetailRow>
              <DetailRow label="To">{openItem.to_addr}</DetailRow>
              {openItem.duration_seconds ? <DetailRow label="Duration">{duration(openItem.duration_seconds)}</DetailRow> : null}
              <DetailRow label="Logged by">{ownerName(staff, openItem.created_by)}</DetailRow>
            </div>
            {openItem.subject && <p className="text-sm font-medium">{openItem.subject}</p>}
            {openItem.ai_summary && <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">AI summary</p>{openItem.ai_summary}</div>}
            {openItem.body && <p className="max-h-80 overflow-y-auto rounded-lg border p-3 text-sm whitespace-pre-wrap break-words">{openItem.body}</p>}
            {openItem.transcript && <div><p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Transcript</p><p className="max-h-64 overflow-y-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">{openItem.transcript}</p></div>}
          </DialogContent>
        )}
      </Dialog>

      {log && <LogDialog initial={log === "pick" ? null : log} target={target} onClose={() => setLog(null)} />}
    </Panel>
  );
}

export type LogKind = "call" | "email" | "sms" | "note" | "meeting" | "task";
const LOG: Record<LogKind, { label: string; subject: string; body: string; direction?: boolean; duration?: boolean }> = {
  call: { label: "Call", subject: "Summary", body: "What was said", direction: true, duration: true },
  email: { label: "Email", subject: "Subject", body: "Message", direction: true },
  sms: { label: "Text", subject: "Summary", body: "Message", direction: true },
  note: { label: "Note", subject: "Title", body: "Note" },
  meeting: { label: "Meeting", subject: "Title", body: "Who attended and what was agreed" },
  task: { label: "Task", subject: "", body: "What needs doing" },
};

// Log something that happened outside Echo, or add a task.
export function LogDialog({ initial, target, onClose }: { initial: LogKind | null; target: Target; onClose: () => void }) {
  const [kind, setKind] = useState<LogKind>(initial ?? "note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState("outbound");
  const [minutes, setMinutes] = useState("");
  const [day, setDay] = useState(today());
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const spec = LOG[kind];

  const save = () => start(async () => {
    const res = kind === "task"
      ? await addActivity({ kind: "task", body, due: day, ...target })
      : await logActivity({ kind, subject, body, direction: spec.direction ? direction : undefined, duration_minutes: Number(minutes) || undefined,
        occurred_at: new Date(`${day}T${time || "12:00"}`).toISOString(), ...target });
    if (res.error) setError(res.error); else onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Add ${spec.label.toLowerCase()}`} className="max-w-lg">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(LOG) as LogKind[]).map((k) => (
            <Button key={k} type="button" size="sm" variant={k === kind ? "secondary" : "ghost"} onClick={() => setKind(k)}>{LOG[k].label}</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {spec.subject && (
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="log-subject">{spec.subject}</Label><Input id="log-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          )}
          {spec.direction && (
            <div className="space-y-1.5"><Label htmlFor="log-dir">Direction</Label>
              <select id="log-dir" value={direction} onChange={(e) => setDirection(e.target.value)} className={SELECT}>
                <option value="outbound">Outbound</option><option value="inbound">Inbound</option>
              </select>
            </div>
          )}
          {spec.duration && (
            <div className="space-y-1.5"><Label htmlFor="log-min">Minutes</Label><Input id="log-min" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          )}
          <div className="space-y-1.5"><Label>{kind === "task" ? "Due" : "Date"}</Label><DatePicker value={day} onChange={setDay} /></div>
          {kind !== "task" && <div className="space-y-1.5"><Label htmlFor="log-time">Time</Label><Input id="log-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="log-body">{spec.body}</Label><Textarea id="log-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={pending || !(body.trim() || subject.trim())}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
