"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, AudioLines, Ban, CalendarClock, CheckSquare, Mail, MailOpen, MessageSquare, Phone, PhoneForwarded, PhoneIncoming, PhoneOutgoing, Play, ShieldAlert, Square, Star, UserCheck, UserPlus, Voicemail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalDate } from "@/components/local-date";
import { Textarea } from "@/components/ui/textarea";
import { saveContact } from "@/lib/admin/actions/crm";
import { addListEntry, saveCallNotes, updateCall, voicemailUrl } from "@/lib/redial/actions";
import { CATEGORY_LABEL, STATUS_LABEL, allows, type Access, type Call, type Callback, type Category, type Line, type ListEntry } from "@/lib/redial/types";
import type { RedialUsage } from "@/lib/redial/usage";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { CallbackDialog, Callbacks } from "./callbacks";
import { LinePeople } from "./line-people";
import { LiveCalls } from "./live-calls";
import type { DirectoryEntry, LinePerson } from "@/lib/redial/data";
import { DirectorySettings } from "./directory-settings";
import { MirrorSettingsPanel } from "./mirror-settings";
import type { MirrorSettings } from "@/lib/redial/mirror";
import { AssistantSettings, RulesSettings, useLineForm } from "./line-settings";

export const prettyNumber = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "No caller ID");
const outgoing = (c: Call) => c.direction === "outbound";
// The other person's number: who called in, or who the line called.
const otherNumber = (c: Call) => (outgoing(c) ? c.to_number ?? null : c.from_number);
const who = (c: Call) => (outgoing(c) ? prettyNumber(c.to_number ?? null) : c.caller_name || c.caller_id_name || prettyNumber(c.from_number));
const unread = (c: Call) => !outgoing(c) && !c.read_at && !c.archived_at && ["message", "completed", "missed", "connected"].includes(c.status);
const duration = (s: number | null) => (!s ? "" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
const cost = (cents: number | null | undefined) => (cents == null ? "" : cents < 1 ? `${Number(cents).toFixed(1)}¢` : `$${(Number(cents) / 100).toFixed(Number(cents) < 100 ? 3 : 2)}`);
const FILTERS = [["inbox", "All"], ["incoming", "In"], ["outgoing", "Out"], ["messages", "Messages"], ["archived", "Archived"]] as const;
type Filter = (typeof FILTERS)[number][0];

const CATEGORY_TONE: Record<Category, string> = {
  personal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", business: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  sales: "bg-amber-500/15 text-amber-800 dark:text-amber-300", spam: "bg-red-500/15 text-red-700 dark:text-red-300", unknown: "bg-muted text-muted-foreground",
};

export function CallsView({ line, access, calls, entries, callbacks, people, directory, mirror, initialCall, initialTab, ownerFirst, usage, canCrm = false }: {
  line: Line; access: Access; calls: Call[]; entries: ListEntry[]; callbacks: Callback[]; people: LinePerson[]; directory: DirectoryEntry[]; mirror: MirrorSettings;
  initialCall: string | null; initialTab: string | null; ownerFirst: string; usage: RedialUsage | null; canCrm?: boolean;
}) {
  const manage = allows(access, "manage_rules");
  const editDirectory = allows(access, "manage_directory");
  const form = useLineForm(line);
  const [filter, setFilter] = useState<Filter>("inbox");
  const [selected, setSelected] = useState<string | null>(initialCall ?? calls.find((c) => !c.archived_at)?.id ?? null);
  const shown = useMemo(() => calls.filter((c) => {
    if (filter === "archived") return Boolean(c.archived_at);
    if (c.archived_at) return false;
    if (filter === "incoming") return !outgoing(c);
    if (filter === "outgoing") return outgoing(c);
    if (filter === "messages") return Boolean(c.message);
    return true;
  }), [calls, filter]);
  const call = calls.find((c) => c.id === selected) ?? null;
  const openCallbacks = callbacks.filter((c) => !c.done_at).length;
  const needsSetup = !line.forward_to;

  return (
    <div className="space-y-4">
      {line.paused && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Screening is paused: calls ring straight through. Turn it back on under Rules.</p>}
      {usage && <UsageBar usage={usage} />}
      {manage && needsSetup && !line.paused && <p className="rounded-xl border p-3 text-sm">Add the phone number your assistant should ring (usually your cell) under <span className="font-medium">Rules</span>, so it can put important calls through.</p>}
      <LiveCalls line={line} owner={access.owner} canReadTranscript={allows(access, "read_transcript")} canListen={allows(access, "monitor_live")} canTakeOver={allows(access, "takeover_live")} canDirect={allows(access, "direct_agent")}
        canTransfer={allows(access, "transfer_call")} canCustomTransfer={allows(access, "dial_custom_destination")} directory={directory}
        canMirror={allows(access, "mirror") && mirror.enabled} />
      {!access.owner && <p className="rounded-xl border p-3 text-sm text-muted-foreground">This line is shared with you{manage ? "" : ". You can see its calls; only the owner changes its settings"}.</p>}
      <Tabs defaultValue={[...["inbox", "callbacks"], ...(manage ? ["rules", "assistant"] : []), ...(editDirectory ? ["directory"] : []), ...(manage ? ["mirror"] : []), ...(access.owner ? ["people"] : [])].includes(initialTab ?? "") ? initialTab! : "inbox"}>
        <TabsList variant="line">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="callbacks">Callbacks{openCallbacks ? ` (${openCallbacks})` : ""}</TabsTrigger>
          {manage && <TabsTrigger value="rules">Rules</TabsTrigger>}
          {manage && <TabsTrigger value="assistant">Assistant</TabsTrigger>}
          {editDirectory && <TabsTrigger value="directory">Directory</TabsTrigger>}
          {manage && <TabsTrigger value="mirror">Mirror</TabsTrigger>}
          {access.owner && <TabsTrigger value="people">People{people.length ? ` (${people.length})` : ""}</TabsTrigger>}
        </TabsList>

        <TabsContent value="inbox" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <div className="space-y-2">
              <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
                {FILTERS.map(([f, label]) => (
                  <button key={f} type="button" onClick={() => setFilter(f)} className={cn("flex-1 rounded-md px-1.5 py-1 font-medium", filter === f ? "bg-card shadow-sm" : "text-muted-foreground")}>{label}</button>
                ))}
              </div>
              {shown.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{filter === "archived" ? "Nothing archived." : filter === "outgoing" ? "No calls out yet. Calls from your desk phones on this line show up here." : `No calls yet. Calls in and out of ${prettyNumber(line.number)} show up here.`}</p>
              ) : (
                <ul className="max-h-[70vh] divide-y overflow-y-auto rounded-xl border bg-card">
                  {shown.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { setSelected(c.id); if (unread(c)) void updateCall(c.id, { read: true }); }}
                        className={cn("flex w-full gap-3 p-3 text-left hover:bg-muted/50", selected === c.id && "bg-muted")}>
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread(c) ? "bg-primary" : "bg-transparent")} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={cn("flex min-w-0 items-center gap-1.5 text-sm", unread(c) && "font-semibold")}>
                              {outgoing(c) ? <PhoneOutgoing className="size-3.5 shrink-0 text-muted-foreground" aria-label="Outgoing" /> : <PhoneIncoming className="size-3.5 shrink-0 text-muted-foreground" aria-label="Incoming" />}
                              <span className="truncate">{who(c)}</span>
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground"><LocalDate iso={c.started_at} short /></span>
                          </span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">{c.summary || c.message || c.reason || STATUS_LABEL[c.status]}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">{outgoing(c) && c.status === "completed" ? "Answered" : STATUS_LABEL[c.status]}</span>
                            {c.duration_seconds ? <span className="rounded-full border px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">{duration(c.duration_seconds)}</span> : null}
                            {c.recording_id && <span className="rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">Recorded</span>}
                            {c.verdict === "likely_scam" && <span className="rounded-full bg-red-500/15 px-1.5 py-px text-[10px] font-medium text-red-700 dark:text-red-300">Likely scam</span>}
                            {c.category && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", CATEGORY_TONE[c.category])}>{CATEGORY_LABEL[c.category]}</span>}
                            {c.urgency === "high" && <span className="rounded-full bg-red-500/15 px-1.5 py-px text-[10px] font-medium text-red-700 dark:text-red-300">Urgent</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {call ? <CallDetail key={call.id} call={call} line={line} entries={entries} manage={manage} canCrm={canCrm} /> : (
              <p className="hidden rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground lg:block">Choose a call to see its details.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="callbacks" className="pt-4"><Callbacks line={line} callbacks={callbacks} calls={calls} /></TabsContent>
        {manage && <TabsContent value="rules" className="pt-4"><RulesSettings line={line} form={form} entries={entries} /></TabsContent>}
        {manage && <TabsContent value="assistant" className="pt-4"><AssistantSettings line={line} form={form} ownerFirst={ownerFirst} /></TabsContent>}
        {editDirectory && <TabsContent value="directory" className="pt-4"><DirectorySettings lineId={line.id} entries={directory} canEdit /></TabsContent>}
        {manage && <TabsContent value="mirror" className="pt-4"><MirrorSettingsPanel lineId={line.id} initial={mirror} /></TabsContent>}
        {access.owner && <TabsContent value="people" className="pt-4"><LinePeople lineId={line.id} people={people} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function CallDetail({ call: c, line, entries, manage, canCrm }: { call: Call; line: Line; entries: ListEntry[]; manage: boolean; canCrm: boolean }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const [audio, setAudio] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [notes, setNotes] = useState(c.notes ?? "");
  const act = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));
  const other = otherNumber(c);
  const listed = other ? entries.find((e) => e.number === other) : undefined;
  const back = outgoing(c) ? other : c.callback_number || c.from_number;
  const facts = [
    <LocalDate key="d" iso={c.started_at} />,
    c.duration_seconds ? `${duration(c.duration_seconds)} on the call` : null,
    c.cost_cents != null ? `Cost ${cost(c.cost_cents)}` : c.ended_at && c.direction ? "Cost: checking with Twilio…" : null,
  ].filter(Boolean);
  const addContact = () => act(async () => {
    const [first, ...rest] = (c.caller_name || c.caller_id_name || "").trim().split(/\s+/).filter(Boolean);
    const r = await saveContact(null, { first_name: first || prettyNumber(other), last_name: rest.join(" "), phone: other ?? "", source: `Redial call (${line.label})`, notes: c.summary ?? "" });
    return r.error ? r : { ok: `${r.ok} Open Admin → Contacts to add more.` };
  });

  return (
    <article className="space-y-5 rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {outgoing(c) ? <><PhoneOutgoing className="size-3.5" /> Outgoing call</> : <><PhoneIncoming className="size-3.5" /> Incoming call</>}
          </p>
          <h2 className="text-xl font-semibold">{who(c)}</h2>
          <p className="text-sm text-muted-foreground">
            {prettyNumber(other)}{facts.map((f, i) => <span key={i}> · {f}</span>)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{outgoing(c) && c.status === "completed" ? "Answered" : STATUS_LABEL[c.status]}{c.reason ? ` · ${c.reason}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {back && <Button size="sm" nativeButton={false} render={<a href={`tel:${back}`} />}><Phone /> Call back</Button>}
          {back && <Button size="sm" variant="outline" nativeButton={false} render={<a href={`sms:${back}`} />}><MessageSquare /> Text</Button>}
          <Button size="sm" variant="outline" onClick={() => setScheduling(true)}><CalendarClock /> Remind me</Button>
          {canCrm && other && <Button size="sm" variant="outline" disabled={pending} onClick={addContact}><UserPlus /> Add to contacts</Button>}
        </div>
      </header>
      {c.verdict === "likely_scam" && (
        <p className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300"><ShieldAlert className="mt-0.5 size-4 shrink-0" /> Redial flagged this as a likely scam and didn&apos;t put it through.</p>
      )}
      <EchoSection call={c} line={line} />

      {c.summary && <p className="rounded-lg bg-muted/60 p-3 text-sm">{c.summary}</p>}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {c.purpose && <div><dt className="text-xs text-muted-foreground">Why they called</dt><dd>{c.purpose}</dd></div>}
        {c.callback_number && <div><dt className="text-xs text-muted-foreground">Call back on</dt><dd>{prettyNumber(c.callback_number)}</dd></div>}
      </dl>
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
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium">Conversation with your assistant</summary>
          <ol className="mt-3 space-y-2 text-sm">
            {c.transcript.map((t, i) => (
              <li key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2", t.role === "assistant" ? "bg-muted" : "ml-auto bg-primary/10")}>
                <span className="block text-[10px] font-medium text-muted-foreground">{t.role === "assistant" ? line.assistant_name : "Caller"}</span>{t.text}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-muted-foreground">Transcribed automatically; may contain mistakes.</p>
        </details>
      )}

      <section className="space-y-1.5">
        <label htmlFor={`notes-${c.id}`} className="text-xs font-medium text-muted-foreground">Notes</label>
        <Textarea id={`notes-${c.id}`} rows={3} maxLength={10000} placeholder="Anything to remember about this call" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {notes !== (c.notes ?? "") && <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => saveCallNotes(c.id, notes))}>Save notes</Button>}
      </section>

      <footer className="flex flex-wrap items-center gap-2 border-t pt-4">
        <label className="sr-only" htmlFor="call-cat">Label</label>
        <Pick id="call-cat" label="Label" className="w-auto" value={c.category ?? "unknown"} disabled={pending} onChange={(v) => act(() => updateCall(c.id, { category: v as Category }))}
          options={(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => ({ value: k, label: CATEGORY_LABEL[k] }))} />
        {manage && other && listed?.kind !== "vip" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => addListEntry(line.id, other, "vip", who(c)))}><Star /> VIP</Button>}
        {manage && other && !listed && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => addListEntry(line.id, other, "allow", who(c)))}><UserCheck /> Allow</Button>}
        {manage && other && listed?.kind !== "block" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(`Block ${prettyNumber(other)}? Their calls will be rejected. You can undo this under Rules.`)) act(() => addListEntry(line.id, other, "block", who(c))); }}><Ban /> Block</Button>
        )}
        {listed && <span className="text-xs text-muted-foreground">{listed.kind === "block" ? "Blocked" : listed.kind === "vip" ? "VIP" : "On your allow list"}</span>}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateCall(c.id, { read: false }))}><MailOpen /> Mark unread</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateCall(c.id, { archived: !c.archived_at }))}>{c.archived_at ? <><ArchiveRestore /> Unarchive</> : <><Archive /> Archive</>}</Button>
      </footer>
      {c.status === "connected" && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PhoneForwarded className="size-3.5" /> Your assistant put this call through to you.</p>}
      {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      {scheduling && <CallbackDialog line={line} call={c} onClose={() => setScheduling(false)} />}
    </article>
  );
}

// The call's Echo recording: transcription progress, then the summary and
// action items, with a link to the full transcript and Ask AI in Echo.
function EchoSection({ call: c, line }: { call: Call; line: Line }) {
  const e = c.echo;
  if (!e) {
    if (c.recording_id || !c.duration_seconds || line.record_calls === false || c.status === "message") return null;
    return <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground"><AudioLines className="size-4" /> The recording usually appears here a minute after the call ends.</p>;
  }
  const busy = e.status === "processing";
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium"><AudioLines className="size-4" /> Recording</h3>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/recordings/${e.id}`} />}>Transcript and Ask AI</Button>
      </div>
      {busy ? <p className="text-sm text-muted-foreground">Transcribing and summarizing… this takes a minute or two.</p> : e.status === "failed" ? (
        <p className="text-sm text-muted-foreground">The transcript couldn&apos;t be made. Open the recording to try again.</p>
      ) : (
        <>
          {e.overview && <p className="text-sm">{e.overview}</p>}
          {e.actions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Action items</p>
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

// "12 of 50 screening minutes used this month", with a way to get more.
function UsageBar({ usage: u }: { usage: RedialUsage }) {
  const pct = u.allowance ? Math.min(100, (u.used_minutes / u.allowance) * 100) : 100;
  const out = u.remaining_seconds < 30;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3", out && "border-destructive/40 bg-destructive/5")}>
      <div className="min-w-48 flex-1 space-y-1.5">
        <p className="text-sm">
          <span className="font-medium tabular-nums">{u.used_minutes}</span> of <span className="tabular-nums">{u.allowance}</span> screening minutes used this month
          {u.pack_minutes > 0 && <span className="text-muted-foreground"> (includes {u.pack_minutes} pack minutes)</span>}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={u.allowance} aria-valuenow={u.used_minutes} aria-label="Screening minutes used">
          <div className={cn("h-full rounded-full", out ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        {out && <p className="text-xs text-destructive">Unknown callers go to voicemail until your minutes reset next month.</p>}
        {u.free && !out && <p className="text-xs text-muted-foreground">Free trial minutes. A Redial plan adds more every month.</p>}
      </div>
      <Button size="sm" variant={out ? "default" : "outline"} nativeButton={false} render={<Link href="/pricing" />}>{u.free ? "Get Redial" : "Add minutes"}</Button>
    </div>
  );
}
