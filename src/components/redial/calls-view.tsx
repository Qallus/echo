"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Ban, CalendarClock, Mail, MailOpen, Phone, PhoneForwarded, Play, Star, UserCheck, Voicemail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalDate } from "@/components/local-date";
import { addListEntry, updateCall, voicemailUrl } from "@/lib/redial/actions";
import { CATEGORY_LABEL, STATUS_LABEL, allows, type Access, type Call, type Callback, type Category, type Line, type ListEntry } from "@/lib/redial/types";
import type { RedialUsage } from "@/lib/redial/usage";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { CallbackDialog, Callbacks } from "./callbacks";
import { LinePeople } from "./line-people";
import type { LinePerson } from "@/lib/redial/data";
import { AssistantSettings, RulesSettings, useLineForm } from "./line-settings";

const SELECT = "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30";
export const prettyNumber = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "No caller ID");
const who = (c: Call) => c.caller_name || c.caller_id_name || prettyNumber(c.from_number);
const unread = (c: Call) => !c.read_at && !c.archived_at && ["message", "completed", "missed", "connected"].includes(c.status);

const CATEGORY_TONE: Record<Category, string> = {
  personal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", business: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  sales: "bg-amber-500/15 text-amber-800 dark:text-amber-300", spam: "bg-red-500/15 text-red-700 dark:text-red-300", unknown: "bg-muted text-muted-foreground",
};

export function CallsView({ line, access, calls, entries, callbacks, people, initialCall, initialTab, ownerFirst, usage }: {
  line: Line; access: Access; calls: Call[]; entries: ListEntry[]; callbacks: Callback[]; people: LinePerson[]; initialCall: string | null; initialTab: string | null; ownerFirst: string; usage: RedialUsage | null;
}) {
  const manage = allows(access, "manage_rules");
  const form = useLineForm(line);
  const [filter, setFilter] = useState<"inbox" | "messages" | "archived">("inbox");
  const [selected, setSelected] = useState<string | null>(initialCall ?? calls.find((c) => !c.archived_at)?.id ?? null);
  const shown = useMemo(() => calls.filter((c) => (filter === "archived" ? c.archived_at : !c.archived_at && (filter === "inbox" || c.message))), [calls, filter]);
  const call = calls.find((c) => c.id === selected) ?? null;
  const openCallbacks = callbacks.filter((c) => !c.done_at).length;
  const needsSetup = !line.forward_to;

  return (
    <div className="space-y-4">
      {line.paused && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Screening is paused: calls ring straight through. Turn it back on under Rules.</p>}
      {usage && <UsageBar usage={usage} />}
      {manage && needsSetup && !line.paused && <p className="rounded-xl border p-3 text-sm">Add the phone number your assistant should ring (usually your cell) under <span className="font-medium">Rules</span>, so it can put important calls through.</p>}
      {!access.owner && <p className="rounded-xl border p-3 text-sm text-muted-foreground">This line is shared with you{manage ? "" : ". You can see its calls; only the owner changes its settings"}.</p>}
      <Tabs defaultValue={[...["inbox", "callbacks"], ...(manage ? ["rules", "assistant"] : []), ...(access.owner ? ["people"] : [])].includes(initialTab ?? "") ? initialTab! : "inbox"}>
        <TabsList variant="line">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="callbacks">Callbacks{openCallbacks ? ` (${openCallbacks})` : ""}</TabsTrigger>
          {manage && <TabsTrigger value="rules">Rules</TabsTrigger>}
          {manage && <TabsTrigger value="assistant">Assistant</TabsTrigger>}
          {access.owner && <TabsTrigger value="people">People{people.length ? ` (${people.length})` : ""}</TabsTrigger>}
        </TabsList>

        <TabsContent value="inbox" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <div className="space-y-2">
              <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
                {(["inbox", "messages", "archived"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)} className={cn("flex-1 rounded-md px-2 py-1 font-medium capitalize", filter === f ? "bg-card shadow-sm" : "text-muted-foreground")}>{f}</button>
                ))}
              </div>
              {shown.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{filter === "archived" ? "Nothing archived." : `No calls yet. When someone calls ${prettyNumber(line.number)}, they show up here.`}</p>
              ) : (
                <ul className="max-h-[70vh] divide-y overflow-y-auto rounded-xl border bg-card">
                  {shown.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { setSelected(c.id); if (unread(c)) void updateCall(c.id, { read: true }); }}
                        className={cn("flex w-full gap-3 p-3 text-left hover:bg-muted/50", selected === c.id && "bg-muted")}>
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread(c) ? "bg-primary" : "bg-transparent")} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={cn("truncate text-sm", unread(c) && "font-semibold")}>{who(c)}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground"><LocalDate iso={c.started_at} short /></span>
                          </span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">{c.summary || c.message || c.reason || STATUS_LABEL[c.status]}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">{STATUS_LABEL[c.status]}</span>
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
            {call ? <CallDetail key={call.id} call={call} line={line} entries={entries} manage={manage} /> : (
              <p className="hidden rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground lg:block">Choose a call to see what the caller said.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="callbacks" className="pt-4"><Callbacks line={line} callbacks={callbacks} calls={calls} /></TabsContent>
        {manage && <TabsContent value="rules" className="pt-4"><RulesSettings line={line} form={form} entries={entries} /></TabsContent>}
        {manage && <TabsContent value="assistant" className="pt-4"><AssistantSettings line={line} form={form} ownerFirst={ownerFirst} /></TabsContent>}
        {access.owner && <TabsContent value="people" className="pt-4"><LinePeople lineId={line.id} people={people} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function CallDetail({ call: c, line, entries, manage }: { call: Call; line: Line; entries: ListEntry[]; manage: boolean }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const [audio, setAudio] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const act = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));
  const listed = c.from_number ? entries.find((e) => e.number === c.from_number) : undefined;
  const back = c.callback_number || c.from_number;

  return (
    <article className="space-y-5 rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{who(c)}</h2>
          <p className="text-sm text-muted-foreground">
            {prettyNumber(c.from_number)} · <LocalDate iso={c.started_at} />{c.duration_seconds ? ` · ${Math.ceil(c.duration_seconds / 60)} min` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{STATUS_LABEL[c.status]}{c.reason ? ` · ${c.reason}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {back && <Button size="sm" nativeButton={false} render={<a href={`tel:${back}`} />}><Phone /> Call back</Button>}
          <Button size="sm" variant="outline" onClick={() => setScheduling(true)}><CalendarClock /> Remind me</Button>
        </div>
      </header>

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

      <footer className="flex flex-wrap items-center gap-2 border-t pt-4">
        <label className="sr-only" htmlFor="call-cat">Label</label>
        <select id="call-cat" className={SELECT} value={c.category ?? "unknown"} disabled={pending} onChange={(e) => act(() => updateCall(c.id, { category: e.target.value as Category }))}>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
        </select>
        {manage && c.from_number && listed?.kind !== "vip" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => addListEntry(line.id, c.from_number!, "vip", who(c)))}><Star /> VIP</Button>}
        {manage && c.from_number && !listed && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => addListEntry(line.id, c.from_number!, "allow", who(c)))}><UserCheck /> Allow</Button>}
        {manage && c.from_number && listed?.kind !== "block" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(`Block ${prettyNumber(c.from_number)}? Their calls will be rejected. You can undo this under Rules.`)) act(() => addListEntry(line.id, c.from_number!, "block", who(c))); }}><Ban /> Block</Button>
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
