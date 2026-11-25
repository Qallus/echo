"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCheck, Copy, MessageSquare, Paperclip, Phone, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { Pick } from "@/components/ui/pick";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { CollectionView } from "@/components/collection/collection-view";
import { IconTile, muted } from "@/components/collection/kit";
import { prettyNumber } from "@/components/redial/phone-center";
import { markLineThreadRead, sendLineText } from "@/lib/redial/text-actions";
import { cn } from "@/lib/utils";

// SMS from your Redial line(s): conversations in the shared list layout, a
// conversation opens in a sheet, and New texts one person or several.

export type LineText = {
  id: string; line_id: string; direction: "inbound" | "outbound"; from_number: string; to_number: string; body: string;
  status: string | null; error: string | null; media: unknown[] | null; read_at: string | null; created_at: string;
};
export type TextLine = { id: string; number: string; label: string };
export type TextPerson = { id: string; name: string; phone: string };
type Thread = { key: string; lineId: string; number: string; list: LineText[]; person: TextPerson | null; unread: number };

const last10 = (n: string | null | undefined) => (n ?? "").replace(/\D/g, "").slice(-10);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function LineTexts({ lines, texts, people, optOuts }: { lines: TextLine[]; texts: LineText[]; people: TextPerson[]; optOuts: string[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newTo, setNewTo] = useState<string[] | null>(null);
  const [lineId, setLineId] = useState(lines[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const byPhone = useMemo(() => new Map(people.map((p) => [last10(p.phone), p])), [people]);
  const lineName = (id: string) => { const l = lines.find((x) => x.id === id); return l ? `${l.label} · ${prettyNumber(l.number)}` : ""; };
  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, LineText[]>();
    for (const t of texts) {
      const other = t.direction === "inbound" ? t.from_number : t.to_number;
      const key = `${t.line_id}|${other}`;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()].map(([key, list]) => {
      const [lid, number] = key.split("|");
      return { key, lineId: lid, number, list, person: byPhone.get(last10(number)) ?? null, unread: list.filter((t) => t.direction === "inbound" && !t.read_at).length };
    });
  }, [texts, byPhone]);

  const thread = threads.find((t) => t.key === openKey) ?? null;
  const from = thread?.lineId ?? lineId;
  const recipients = newTo ?? (thread ? [thread.number] : []);
  const blocked = recipients.filter((n) => optOuts.some((o) => last10(o) === last10(n)));
  const canSend = !pending && Boolean(draft.trim()) && recipients.length > 0 && blocked.length === 0 && Boolean(from);
  const person = thread?.person ?? (newTo?.length === 1 ? byPhone.get(last10(newTo[0])) ?? null : null);
  const toOptions = [
    ...people.map((p) => ({ value: p.phone, label: p.name, hint: prettyNumber(p.phone) })),
    ...(newTo ?? []).filter((n) => !byPhone.has(last10(n))).map((n) => ({ value: n, label: prettyNumber(n) })),
  ];
  const typedNumber = (typed: string) => {
    const digits = typed.replace(/\D/g, "");
    if (digits.length < 10) return null;
    const value = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    return byPhone.has(last10(value)) ? null : { value, label: prettyNumber(value), hint: "Text this number" };
  };

  const open = (t: Thread) => {
    setOpenKey(t.key); setNewTo(null); setDraft(""); setMsg({});
    if (t.unread) start(async () => { await markLineThreadRead(t.lineId, t.number); });
  };
  const close = () => { setOpenKey(null); setNewTo(null); };
  const send = () => start(async () => {
    const res = await sendLineText({ lineId: from, to: recipients, body: draft });
    setMsg(res);
    if (res.sent) {
      setDraft("");
      if (newTo?.length === 1 && !res.error) { setOpenKey(`${from}|${newTo[0]}`); setNewTo(null); }
      else if (newTo && !res.error) setNewTo([]);
    }
  });

  return (
    <div className="space-y-3">
      <CollectionView<Thread>
        items={threads} getId={(t) => t.key} title={(t) => t.person?.name ?? prettyNumber(t.number)} noun={["conversation", "conversations"]} storageKey="sms" defaultView="list"
        subtitle={(t) => <span className={cn(t.unread > 0 && "font-medium text-foreground")}>{t.list[0]?.body || "(attachment)"}</span>}
        media={() => <IconTile icon={MessageSquare} />}
        badge={(t) => (t.unread > 0 ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{t.unread}</span>
          : optOuts.includes(t.number) ? <Badge variant="outline" className="text-destructive">STOP</Badge> : null)}
        meta={(t) => when(t.list[0].created_at)}
        searchText={(t) => `${t.number} ${t.person?.name ?? ""} ${t.list.map((x) => x.body).join(" ")}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "unread", label: "Unread", test: (t) => t.unread > 0 },
          { id: "contacts", label: "Contacts", test: (t) => !!t.person },
          { id: "unknown", label: "Unknown numbers", test: (t) => !t.person },
          ...(lines.length > 1 ? lines.map((l) => ({ id: `line:${l.id}`, label: `On ${l.label}`, test: (t: Thread) => t.lineId === l.id })) : []),
        ]}
        date={(t) => t.list[0].created_at}
        columns={[
          { id: "who", label: "Who", sort: (t) => (t.person?.name ?? t.number).toLowerCase(), cell: (t) => <span className={cn(t.unread > 0 && "font-semibold")}>{t.person?.name ?? prettyNumber(t.number)}</span> },
          { id: "number", label: "Number", sort: (t) => t.number, cell: (t) => muted(prettyNumber(t.number)) },
          ...(lines.length > 1 ? [{ id: "line", label: "Line", cell: (t: Thread) => muted(lineName(t.lineId)) }] : []),
          { id: "last", label: "Last message", cell: (t) => <span className="block max-w-md truncate text-muted-foreground">{t.list[0]?.body}</span> },
          { id: "when", label: "Last", sort: (t) => t.list[0].created_at, cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{when(t.list[0].created_at)}</span> },
        ]}
        actions={[
          { label: "Mark read", icon: CheckCheck, show: (rows) => rows.some((t) => t.unread > 0), run: (rows) => start(async () => { for (const t of rows.filter((x) => x.unread)) await markLineThreadRead(t.lineId, t.number); }) },
          { label: "Copy numbers", icon: Copy, run: (rows) => { void navigator.clipboard.writeText(rows.map((t) => t.number).join(", ")); } },
        ]}
        onOpen={open}
        empty="No texts yet. Texts to your Redial number show up here."
        toolbar={<Button onClick={() => { setNewTo([]); setOpenKey(null); setDraft(""); setMsg({}); }}><Plus /> New</Button>}
      />

      <ResponsivePanel open={thread !== null || newTo !== null} onOpenChange={(o) => !o && close()} id="sms-thread" defaultWidth={520} fullHeight={newTo === null} bodyClassName="flex flex-col"
        title={newTo !== null ? "New text" : <p className="truncate font-medium">{person?.name ?? prettyNumber(thread?.number)}</p>}
        description={newTo === null && thread ? <p className="text-xs text-muted-foreground">{prettyNumber(thread.number)}{lines.length > 1 ? ` · on ${lineName(thread.lineId)}` : ""}</p> : undefined}
        actions={<>
          {person && <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/contacts/${person.id}`} />}>Contact</Button>}
          {thread && <Button variant="outline" size="icon-sm" aria-label="Call" nativeButton={false} render={<Link href={`/calls?tab=phone&dial=${encodeURIComponent(thread.number)}`} />}><Phone /></Button>}
        </>}
        footer={
          <div className="space-y-2">
            {blocked.length > 0 && <Badge variant="outline" className="h-auto whitespace-normal text-destructive">
              {blocked.map(prettyNumber).join(", ")} replied STOP. They need to text START first.</Badge>}
            <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Text message" maxLength={1600} aria-label="Message"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) send(); }} />
            <p className="flex justify-between gap-2 text-[11px] text-muted-foreground"><span>{msg.error ?? msg.ok ?? "Ctrl+Enter to send"}</span><span className="shrink-0">{draft.length}/1600</span></p>
            <Button size="lg" className="w-full" disabled={!canSend} onClick={send}><Send /> {pending ? "Sending…" : recipients.length > 1 ? `Send to ${recipients.length}` : "Send"}</Button>
          </div>
        }>
        {newTo !== null ? (
          <div className="space-y-3">
            {lines.length > 1 && (
              <Pick label="From" value={lineId} onChange={setLineId} options={lines.map((l) => ({ value: l.id, label: `${l.label} · ${prettyNumber(l.number)}` }))} />
            )}
            <div className="space-y-1.5">
              <MultiCombobox autoFocus label="To" placeholder="Search contacts or type a number" empty="No match. Type a full phone number to text it."
                options={toOptions} value={newTo} create={typedNumber} onChange={setNewTo} />
              <p className="text-xs text-muted-foreground">Pick one person for a conversation, or several to text each of them.</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto md:max-h-[60dvh] md:flex-none">
            {thread?.list.map((t) => (
              <div key={t.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", t.direction === "outbound" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted")}>
                <p className="break-words whitespace-pre-wrap">{t.body}</p>
                {(t.media?.length ?? 0) > 0 && <p className="mt-1 flex items-center gap-1 text-xs opacity-80"><Paperclip className="size-3" /> {t.media!.length} attachment{t.media!.length > 1 ? "s" : ""}</p>}
                <p className={cn("mt-1 text-[10px]", t.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {when(t.created_at)}{t.direction === "outbound" && t.status ? ` · ${t.status}` : ""}{t.error ? ` · ${t.error}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </ResponsivePanel>
    </div>
  );
}
