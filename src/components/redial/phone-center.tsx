"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Archive, ArchiveRestore, AudioLines, Ban, CalendarClock, CheckSquare, ChevronDown, Delete, Grid3x3, Mail, MailOpen, MessageSquare, Mic, MicOff, Phone,
  PhoneIncoming, PhoneOff, PhoneOutgoing, Play, RefreshCw, ShieldAlert, Square, Star, UserCheck, UserPlus, Voicemail,
} from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveContact } from "@/lib/admin/actions/crm";
import { addListEntry, saveCallNotes, updateCall, voicemailUrl } from "@/lib/redial/actions";
import { CATEGORY_LABEL, STATUS_LABEL, normalizeNumber, type Call, type Category, type Line, type ListEntry } from "@/lib/redial/types";
import { cn } from "@/lib/utils";
import { CallbackDialog } from "./callbacks";
import { CHECK_SIGNALS, RISK_SIGNALS, VERDICT_LABEL, type Verdict } from "@/lib/redial/protection-shared";
import { useBrowserPhone } from "./use-browser-phone";

// The Phone: a dial pad on the left (calls from the browser on a Redial line,
// recorded unless switched off) and every call in and out on the right. Each
// call opens in place with its details, recording, summary, action items,
// notes and actions. Used on Calls (one line) and in Admin -> Communications
// (every line the person can see).

type Msg = { ok?: string; error?: string };
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
export const prettyNumber = (n: string | null | undefined) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "No caller ID");
const outgoing = (c: Call) => c.direction === "outbound";
const otherNumber = (c: Call) => (outgoing(c) ? c.to_number ?? null : c.from_number);
const who = (c: Call) => (outgoing(c) ? prettyNumber(c.to_number) : c.caller_name || c.caller_id_name || prettyNumber(c.from_number));
const unread = (c: Call) => !outgoing(c) && !c.read_at && !c.archived_at && ["message", "completed", "missed", "connected"].includes(c.status);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const cost = (cents: number | null | undefined) => (cents == null ? null : `$${(Number(cents) / 100).toFixed(Number(cents) < 100 ? 3 : 2)}`);
const statusText = (c: Call) => (outgoing(c) && c.status === "completed" ? "Answered" : STATUS_LABEL[c.status]);
const STATUS_TONE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", connected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  forwarded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", message: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  missed: "bg-amber-500/15 text-amber-800 dark:text-amber-300", failed: "bg-red-500/15 text-red-700 dark:text-red-300", blocked: "bg-red-500/15 text-red-700 dark:text-red-300",
};
// Fraud protection verdicts: label colors, and each signal in plain words.
const VERDICT_TONE: Record<Verdict, string> = {
  legit: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", unverified: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  likely_scam: "bg-red-500/15 text-red-700 dark:text-red-300",
};
const signalText = (s: { code: string; detail: string }) => (RISK_SIGNALS as Record<string, string>)[s.code] ?? CHECK_SIGNALS[s.code] ?? s.detail;
const FILTERS = [["all", "All"], ["in", "Inbound"], ["out", "Outbound"], ["voicemail", "Voicemail"], ["archived", "Archived"]] as const;
type Filter = (typeof FILTERS)[number][0];

export function PhoneCenter({ lines, calls, entries, manageLines, canCrm = false, initialCall = null }: {
  lines: Line[]; calls: Call[]; entries: ListEntry[]; manageLines: string[]; canCrm?: boolean; initialCall?: string | null;
}) {
  const router = useRouter();
  const ownLines = lines.filter((l) => manageLines.includes(l.id));
  const [lineId, setLineId] = useState(ownLines[0]?.id ?? "");
  const line = lines.find((l) => l.id === lineId);
  const [dial, setDial] = useState("");
  const [record, setRecord] = useState(line?.record_calls !== false);
  const [keypad, setKeypad] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(initialCall);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  // After a call ends, the log fills in (now), then the recording and cost.
  const phone = useBrowserPhone(() => { refresh(); setTimeout(refresh, 45_000); });

  const shown = useMemo(() => calls.filter((c) => {
    if (filter === "archived") return Boolean(c.archived_at);
    if (c.archived_at) return false;
    if (filter === "in") return !outgoing(c);
    if (filter === "out") return outgoing(c);
    if (filter === "voicemail") return c.status === "message" || Boolean(c.recording_path);
    return true;
  }), [calls, filter]);

  const call = (number: string) => {
    const to = normalizeNumber(number);
    if (!to || !line) return;
    setDial(prettyNumber(to));
    void phone.place({ To: to, LineId: line.id, Record: record ? "1" : "0" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Dial pad */}
      <div className="space-y-3 rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
        <p className="flex items-center gap-2 text-sm font-medium"><Phone className="size-4" /> Dial pad</p>
        {ownLines.length === 0 ? (
          <p className="text-xs text-muted-foreground">Only a line&apos;s owner can call out from it in the browser.</p>
        ) : phone.busy ? (
          <div className="space-y-3 rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{phone.state === "live" ? `On call · ${clock(phone.seconds)}` : "Calling…"}</p>
            <p className="truncate text-lg font-semibold">{dial}</p>
            {keypad && <div className="grid grid-cols-3 gap-1.5">{KEYS.map((k) => <Button key={k} variant="outline" size="sm" onClick={() => phone.digit(k)}>{k}</Button>)}</div>}
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" aria-label={phone.muted ? "Unmute" : "Mute"} onClick={phone.toggleMute}>{phone.muted ? <MicOff /> : <Mic />}</Button>
              <Button variant="outline" aria-label="Keypad" className={cn(keypad && "bg-accent")} onClick={() => setKeypad(!keypad)}><Grid3x3 /></Button>
              <Button variant="destructive" aria-label="Hang up" onClick={phone.hangUp}><PhoneOff /></Button>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); call(dial); }}>
            <Input value={dial} onChange={(e) => setDial(e.target.value)} placeholder="Enter a phone number" inputMode="tel" className="h-11 text-center text-lg" aria-label="Number to call" />
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => <Button key={k} type="button" variant="outline" className="h-11 text-lg" onClick={() => setDial((d) => d + k)}>{k}</Button>)}
            </div>
            {ownLines.length > 1 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Dial out from</p>
                <Pick label="Dial out from" value={lineId} onChange={(v) => { setLineId(v); setRecord(lines.find((l) => l.id === v)?.record_calls !== false); }}
                  options={ownLines.map((l) => ({ value: l.id, label: `${l.label} · ${prettyNumber(l.number)}` }))} />
              </div>
            ) : line && <p className="text-xs text-muted-foreground">Calls go out from {prettyNumber(line.number)}.</p>}
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><span className={cn("size-2 rounded-full", record ? "bg-red-500" : "bg-muted-foreground/40")} /> Record call</span>
              <Switch size="sm" checked={record} onCheckedChange={setRecord} />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button type="submit" className="h-11 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!normalizeNumber(dial)}><Phone /> Call</Button>
              <Button type="button" variant="outline" className="h-11" aria-label="Delete digit" onClick={() => setDial((d) => d.slice(0, -1))}><Delete /></Button>
            </div>
            {record && line?.record_notice !== false && <p className="text-[11px] text-muted-foreground">They&apos;ll hear &ldquo;This call may be recorded.&rdquo;</p>}
          </form>
        )}
        {phone.error && (
          <p className="flex items-start gap-2 text-xs text-destructive"><span className="flex-1">{phone.error}</span><button type="button" className="underline" onClick={phone.clearError}>Dismiss</button></p>
        )}
      </div>

      {/* Call log */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
            {FILTERS.map(([f, label]) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1 font-medium", filter === f ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {f === "in" && <PhoneIncoming className="mr-1 inline size-3" />}{f === "out" && <PhoneOutgoing className="mr-1 inline size-3" />}{label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{shown.length} call{shown.length === 1 ? "" : "s"}</span>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={refresh}><RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh</Button>
        </div>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {filter === "archived" ? "Nothing archived." : "No calls yet. Calls in and out of your Redial lines, from any phone, show up here."}
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((c) => {
              const isOpen = open === c.id;
              const lineOf = lines.find((l) => l.id === c.line_id);
              return (
                <li key={c.id} className={cn("overflow-hidden rounded-xl border bg-card", isOpen && "ring-1 ring-foreground/20")}>
                  <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : c.id); if (!isOpen && unread(c)) void updateCall(c.id, { read: true }); }}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                      {outgoing(c) ? <PhoneOutgoing className="size-4" aria-label="Outgoing" /> : <PhoneIncoming className="size-4" aria-label="Incoming" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("truncate text-sm", unread(c) ? "font-semibold" : "font-medium")}>{who(c)}</span>
                        <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", STATUS_TONE[c.status] ?? "bg-muted text-muted-foreground")}>{statusText(c)}</span>
                        {c.recording_id && <span className="rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-700 dark:text-violet-300">Recorded</span>}
                        {c.verdict && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", VERDICT_TONE[c.verdict])}>{VERDICT_LABEL[c.verdict]}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.duration_seconds ? `${clock(c.duration_seconds)} · ` : ""}{lines.length > 1 && lineOf ? `${lineOf.label} · ` : ""}{c.summary || c.message || c.reason || ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground"><LocalDate iso={c.started_at} short /></span>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && lineOf && (
                    <CallBody call={c} line={lineOf} entries={entries} manage={manageLines.includes(c.line_id)} canCrm={canCrm} canDial={!phone.busy && ownLines.length > 0}
                      onCall={(n) => call(n)} showLine={lines.length > 1} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CallBody({ call: c, line, entries, manage, canCrm, canDial, onCall, showLine }: {
  call: Call; line: Line; entries: ListEntry[]; manage: boolean; canCrm: boolean; canDial: boolean; onCall: (n: string) => void; showLine: boolean;
}) {
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();
  const [audio, setAudio] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [notes, setNotes] = useState(c.notes ?? "");
  const act = (fn: () => Promise<Msg>) => start(async () => setMsg(await fn()));
  const other = otherNumber(c);
  const listed = other ? entries.find((e) => e.line_id === c.line_id && e.number === other) : undefined;
  const back = outgoing(c) ? other : c.callback_number || c.from_number;
  const addContact = () => act(async () => {
    const [first, ...rest] = (c.caller_name || c.caller_id_name || "").trim().split(/\s+/).filter(Boolean);
    const r = await saveContact(null, { first_name: first || prettyNumber(other), last_name: rest.join(" "), phone: other ?? "", source: `Redial call (${line.label})`, notes: c.summary ?? "" });
    return r.error ? r : { ok: `${r.ok} It's in Admin → Contacts.` };
  });
  const facts: [string, React.ReactNode][] = [
    ["Direction", outgoing(c) ? "Outbound" : "Inbound"],
    ["Duration", c.duration_seconds ? clock(c.duration_seconds) : "—"],
    ["Date and time", <LocalDate key="d" iso={c.started_at} />],
    ["Cost", cost(c.cost_cents) ?? (c.ended_at && c.direction ? "Checking…" : "—")],
    ...(showLine ? [["Line", `${line.label} · ${prettyNumber(line.number)}`] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="space-y-4 border-t p-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {facts.map(([k, v]) => <div key={k}><dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {c.reason && <p className="text-xs text-muted-foreground">{statusText(c)} · {c.reason}</p>}

      <div className="flex flex-wrap gap-2">
        {back && (canDial
          ? <Button size="sm" variant="outline" onClick={() => onCall(back)}><Phone /> Call back</Button>
          : <Button size="sm" variant="outline" nativeButton={false} render={<a href={`tel:${back}`} />}><Phone /> Call back</Button>)}
        {back && <Button size="sm" variant="outline" nativeButton={false} render={<a href={`sms:${back}`} />}><MessageSquare /> Text</Button>}
        <Button size="sm" variant="outline" onClick={() => setScheduling(true)}><CalendarClock /> Remind me</Button>
        {canCrm && other && <Button size="sm" variant="outline" disabled={pending} onClick={addContact}><UserPlus /> Add to contacts</Button>}
      </div>

      {c.verdict && <Verdict call={c} />}
      {c.summary && <p className="rounded-lg bg-muted/60 p-3 text-sm">{c.summary}</p>}
      {c.purpose && <p className="text-sm"><span className="text-xs text-muted-foreground">Why they called: </span>{c.purpose}</p>}
      <EchoSection call={c} line={line} />

      {c.message && (
        <section className="space-y-1">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{c.recording_path ? <Voicemail className="size-3.5" /> : <Mail className="size-3.5" />} Message</h3>
          <p className="text-sm whitespace-pre-wrap">{c.message}</p>
        </section>
      )}
      {c.recording_path && (audio ? <audio controls autoPlay src={audio} className="w-full" /> : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await voicemailUrl(c.recording_path!); if (r.url) setAudio(r.url); else setMsg(r); })}><Play /> Play voicemail</Button>
      ))}
      {c.transcript.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Conversation with {line.assistant_name}</summary>
          <ol className="mt-3 space-y-2 text-sm">
            {c.transcript.map((t, i) => (
              <li key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2", t.role === "assistant" ? "bg-muted" : "ml-auto bg-primary/10")}>
                <span className="block text-[10px] font-medium text-muted-foreground">{t.role === "assistant" ? line.assistant_name : "Caller"}</span>{t.text}
              </li>
            ))}
          </ol>
        </details>
      )}

      <section className="space-y-1.5">
        <label htmlFor={`notes-${c.id}`} className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Call notes</label>
        <Textarea id={`notes-${c.id}`} rows={3} maxLength={10000} placeholder="Add a note…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {notes !== (c.notes ?? "") && <Button size="sm" disabled={pending} onClick={() => act(() => saveCallNotes(c.id, notes))}>Save notes</Button>}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Pick label="Label" className="w-auto" size="sm" value={c.category ?? "unknown"} disabled={pending} onChange={(v) => act(() => updateCall(c.id, { category: v as Category }))}
          options={(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => ({ value: k, label: CATEGORY_LABEL[k] }))} />
        {manage && other && listed?.kind !== "vip" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => addListEntry(c.line_id, other, "vip", who(c)))}><Star /> VIP</Button>}
        {manage && other && !listed && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => addListEntry(c.line_id, other, "allow", who(c)))}><UserCheck /> Allow</Button>}
        {manage && other && listed?.kind !== "block" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(`Block ${prettyNumber(other)}? Their calls will be rejected. You can undo this under Rules.`)) act(() => addListEntry(c.line_id, other, "block", who(c))); }}><Ban /> Block</Button>
        )}
        {listed && <span className="text-xs text-muted-foreground">{listed.kind === "block" ? "Blocked" : listed.kind === "vip" ? "VIP" : "On your allow list"}</span>}
        <span className="flex-1" />
        {!outgoing(c) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateCall(c.id, { read: false }))}><MailOpen /> Mark unread</Button>}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateCall(c.id, { archived: !c.archived_at }))}>{c.archived_at ? <><ArchiveRestore /> Unarchive</> : <><Archive /> Archive</>}</Button>
      </div>
      {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      {scheduling && <CallbackDialog line={line} call={c} onClose={() => setScheduling(false)} />}
    </div>
  );
}

// The call's Echo recording: progress, then the summary and action items,
// with the full transcript and Ask AI one click away.
function EchoSection({ call: c, line }: { call: Call; line: Line }) {
  const e = c.echo;
  if (!e) {
    if (c.recording_id || !c.duration_seconds || line.record_calls === false || c.status === "message" || !["completed", "connected", "forwarded"].includes(c.status)) return null;
    return <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground"><AudioLines className="size-4" /> The recording usually appears a minute after the call ends. Refresh to check.</p>;
  }
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium"><AudioLines className="size-4" /> Recording</h3>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/recordings/${e.id}`} />}>Play, transcript and Ask AI</Button>
      </div>
      {e.status === "processing" ? <p className="text-sm text-muted-foreground">Transcribing and summarizing… this takes a minute or two.</p> : e.status === "failed" ? (
        <p className="text-sm text-muted-foreground">The transcript couldn&apos;t be made. Open the recording to try again.</p>
      ) : (
        <>
          {e.overview && <p className="text-sm">{e.overview}</p>}
          {e.actions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Action items</p>
              <ul className="space-y-1 text-sm">
                {e.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">{a.done ? <CheckSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}<span className={cn(a.done && "text-muted-foreground line-through")}>{a.text}</span></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// The fraud-protection verdict and what Redial noticed, with the report page.
function Verdict({ call: c }: { call: Call }) {
  const v = c.verdict!;
  const signals = (c.risk_signals ?? []).filter((s) => !s.code.startsWith("code_word_try"));
  const box = v === "likely_scam" ? "border-red-500/40 bg-red-500/10" : v === "unverified" ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10";
  return (
    <section className={cn("space-y-2 rounded-lg border p-3 text-sm", box)}>
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" />
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", VERDICT_TONE[v])}>{VERDICT_LABEL[v]}</span>
        <span className="text-xs text-muted-foreground">{v === "likely_scam" ? "Redial stopped this call and didn't put it through." : v === "unverified" ? "Redial couldn't confirm who this was." : "Redial confirmed this caller."}</span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/calls/report/${c.id}`} />}>Report page</Button>
      </div>
      {signals.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          {signals.map((s) => <li key={s.code}>{signalText(s)}</li>)}
        </ul>
      )}
    </section>
  );
}
