"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CalendarClock, CheckCheck, Copy, Megaphone, MessageSquare, Paperclip, Phone, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { markThreadRead, scheduleTexts, sendText } from "@/lib/admin/actions/comms-phone";
import type { Scheduled, Text } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { CollectionView } from "@/components/collection/collection-view";
import { IconTile, muted } from "@/components/collection/kit";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { BulkTextDialog } from "./bulk-text-dialog";
import { ScheduleDialog } from "./schedule-dialog";
import { ScheduledList } from "./scheduled-list";
import { startCall } from "./softphone";

export type PhonePerson = { id: string; name: string; phone: string | null };
const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
type Thread = { number: string; list: Text[]; person: PhonePerson | null; unread: number };
const lastLine = (t: Thread) => `${t.list[0].direction === "outbound" ? "You: " : ""}${t.list[0].body || "(attachment)"}`;

// Text conversations on Echo's number, one thread per phone number. The list
// uses the shared layout; a conversation opens in a side panel to read and reply.
export function TextsPanel({ texts, people, optOuts, ready, readOnly, scheduled, cronReady }: {
  texts: Text[]; people: PhonePerson[]; optOuts: string[]; ready: boolean; readOnly: boolean; scheduled: Scheduled[]; cronReady: boolean;
}) {
  const [openNumber, setOpenNumber] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTo, setNewTo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"bulk" | "scheduled" | "later" | null>(null);
  const upcoming = scheduled.filter((x) => x.status === "scheduled" || x.status === "sending").length;

  const byPhone = useMemo(() => new Map(people.filter((p) => p.phone).map((p) => [last10(p.phone), p])), [people]);
  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Text[]>();
    for (const t of texts) {
      const other = t.direction === "inbound" ? t.from_number : t.to_number;
      map.set(other, [...(map.get(other) ?? []), t]);
    }
    return [...map.entries()].map(([number, list]) => ({ number, list, person: byPhone.get(last10(number)) ?? null, unread: list.filter((t) => t.direction === "inbound" && !t.read_at).length }));
  }, [texts, byPhone]);
  const thread = threads.find((t) => t.number === openNumber) ?? null;
  const to = newTo ?? openNumber;
  const person = to ? byPhone.get(last10(to)) ?? null : null;
  const optedOut = to ? optOuts.includes(to) : false;
  const isOpen = thread !== null || newTo !== null;

  const open = (t: Thread) => {
    setOpenNumber(t.number); setNewTo(null); setDraft(""); setMsg({});
    if (t.unread && !readOnly) start(async () => { await markThreadRead(t.number); });
  };
  const close = () => { setOpenNumber(null); setNewTo(null); };
  const markRead = (rows: Thread[]) => start(async () => { for (const t of rows.filter((x) => x.unread)) await markThreadRead(t.number); });
  const send = () => start(async () => {
    const res = await sendText({ to: to!, body: draft, contactId: person?.id });
    setMsg(res);
    if (!res.error) { setDraft(""); if (newTo !== null) { setOpenNumber(newTo); setNewTo(null); } }
  });

  if (!ready) return <EmptyState message="Texting isn't set up yet. Add the Twilio settings in Coolify (see the setup notes) and this tab comes alive." />;

  return (
    <div className="space-y-3">
      <CollectionView<Thread>
        items={threads} getId={(t) => t.number} title={(t) => t.person?.name ?? t.number} noun={["conversation", "conversations"]} storageKey="admin-texts" defaultView="list"
        subtitle={(t) => <span className={cn(t.unread > 0 && "font-medium text-foreground")}>{lastLine(t)}</span>}
        media={() => <IconTile icon={MessageSquare} />}
        badge={(t) => (t.unread > 0 ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{t.unread}</span> : optOuts.includes(t.number) ? <Badge variant="outline" className="text-destructive">STOP</Badge> : null)}
        meta={(t) => when(t.list[0].created_at)}
        searchText={(t) => `${t.number} ${t.person?.name ?? ""} ${t.list.map((x) => x.body).join(" ")}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "unread", label: "Unread", test: (t) => t.unread > 0 },
          { id: "contacts", label: "Contacts", test: (t) => !!t.person },
          { id: "unknown", label: "Unknown numbers", test: (t) => !t.person },
          { id: "stop", label: "Replied STOP", test: (t) => optOuts.includes(t.number) },
        ]}
        date={(t) => t.list[0].created_at}
        columns={[
          { id: "who", label: "Who", sort: (t) => (t.person?.name ?? t.number).toLowerCase(), cell: (t) => <span className={cn(t.unread > 0 && "font-semibold")}>{t.person?.name ?? t.number}</span> },
          { id: "number", label: "Number", sort: (t) => t.number, cell: (t) => muted(t.number) },
          { id: "last", label: "Last message", cell: (t) => <span className="block max-w-md truncate text-muted-foreground">{lastLine(t)}</span> },
          { id: "count", label: "Messages", sort: (t) => t.list.length, cell: (t) => <span className="tabular-nums">{t.list.length}</span> },
          { id: "unread", label: "Unread", sort: (t) => t.unread, cell: (t) => (t.unread ? <span className="tabular-nums font-medium">{t.unread}</span> : muted("—")) },
          { id: "when", label: "Last", sort: (t) => t.list[0].created_at, cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{when(t.list[0].created_at)}</span> },
        ]}
        actions={[
          ...(readOnly ? [] : [{ label: "Mark read", icon: CheckCheck, show: (rows: Thread[]) => rows.some((t) => t.unread > 0), run: markRead }]),
          { label: "Copy numbers", icon: Copy, run: (rows) => { void navigator.clipboard.writeText(rows.map((t) => t.number).join(", ")); } },
          { label: "Call", icon: Phone, single: true, run: ([t]) => startCall({ number: t.number, name: t.person?.name, contactId: t.person?.id }) },
        ]}
        onOpen={open}
        empty="No texts yet."
        toolbar={<>
          {!readOnly && <Button onClick={() => { setNewTo(""); setOpenNumber(null); setDraft(""); setMsg({}); }}><Plus /> New</Button>}
          <Button variant="outline" onClick={() => setPanel("scheduled")}>
            <CalendarClock /> Scheduled{upcoming > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{upcoming}</span>}
          </Button>
          {!readOnly && <Button variant="outline" onClick={() => setPanel("bulk")}><Megaphone /> Text the waitlist</Button>}
        </>}
      />

      <ResponsivePanel open={isOpen} onOpenChange={(o) => !o && close()} id="admin-text-thread" defaultWidth={520} fullHeight bodyClassName="flex flex-col"
        title={newTo !== null
          ? <Input autoFocus value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="Phone number, e.g. (480) 555-0142" list="text-people" className="h-8" aria-label="To" />
          : <p className="truncate font-medium">{person?.name ?? thread?.number}</p>}
        description={newTo === null && person ? <p className="text-xs text-muted-foreground">{thread?.number}</p> : undefined}
        actions={<>
          {person && <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/admin/contacts/${person.id}`} />}>Contact</Button>}
          {to && newTo === null && <Button variant="outline" size="icon-sm" aria-label="Call" onClick={() => startCall({ number: to, name: person?.name, contactId: person?.id })}><Phone /></Button>}
        </>}
        footer={!readOnly && (
          <div className="space-y-2">
            {optedOut && <Badge variant="outline" className="text-destructive">Replied STOP. They need to text START first.</Badge>}
            <div className="flex items-end gap-2">
              <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Text message" maxLength={1600} aria-label="Message"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim() && to) send(); }} />
              <Button variant="outline" disabled={pending || !draft.trim() || !to || optedOut} onClick={() => setPanel("later")} aria-label="Send later" title="Send later"><CalendarClock /></Button>
              <Button disabled={pending || !draft.trim() || !to || optedOut} onClick={send} aria-label="Send"><Send /></Button>
            </div>
            <p className="flex justify-between text-[11px] text-muted-foreground"><span>{msg.error ?? msg.ok ?? "Ctrl+Enter to send"}</span><span>{draft.length}/1600</span></p>
          </div>
        )}>
        <datalist id="text-people">{people.filter((p) => p.phone).map((p) => <option key={p.id} value={p.phone!}>{p.name}</option>)}</datalist>
        {(thread?.list.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{newTo !== null ? "Type a number, then your message." : "No messages."}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto md:max-h-[60dvh] md:flex-none">
            {thread!.list.map((t) => (
              <div key={t.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", t.direction === "outbound" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted")}>
                <p className="break-words whitespace-pre-wrap">{t.body}</p>
                {t.media.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs opacity-80"><Paperclip className="size-3" /> {t.media.length} attachment{t.media.length > 1 ? "s" : ""}</p>}
                <p className={cn("mt-1 text-[10px]", t.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {when(t.created_at)}{t.direction === "outbound" && t.status ? ` · ${t.status}` : ""}{t.error ? ` · ${t.error}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </ResponsivePanel>

      {panel === "bulk" && <BulkTextDialog cronReady={cronReady} onClose={() => setPanel(null)} />}
      {panel === "later" && to && (
        <ScheduleDialog title={`Text ${person?.name ?? to} later`} cronReady={cronReady}
          summary={<p className="rounded-2xl bg-muted p-3 whitespace-pre-wrap break-words">{draft}</p>}
          onSchedule={(sendAt) => scheduleTexts(person ? { contactIds: [person.id], body: draft, sendAt } : { to: [to], body: draft, sendAt })}
          onClose={(done) => { setPanel(null); if (done) { setDraft(""); setMsg({ ok: "Scheduled. See Scheduled." }); } }} />
      )}
      <Sheet open={panel === "scheduled"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg">
          <SheetTitle className="pt-4 pr-6">Scheduled texts</SheetTitle>
          <SheetDescription>Upcoming texts can be canceled until they start.</SheetDescription>
          <ScheduledList items={scheduled} readOnly={readOnly} empty="Nothing scheduled. Use the clock button in a conversation, or Text the waitlist." />
        </SheetContent>
      </Sheet>
    </div>
  );
}
