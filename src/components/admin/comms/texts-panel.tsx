"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, MessageSquare, Paperclip, Phone, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { markThreadRead, sendText } from "@/lib/admin/actions/comms-phone";
import type { Text } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState, SearchBox } from "@/components/admin/crm/crm-kit";
import { startCall } from "./softphone";

export type PhonePerson = { id: string; name: string; phone: string | null };
const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Text conversations on Echo's number, one thread per phone number.
export function TextsPanel({ texts, people, optOuts, ready, readOnly }: {
  texts: Text[]; people: PhonePerson[]; optOuts: string[]; ready: boolean; readOnly: boolean;
}) {
  const [openNumber, setOpenNumber] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [newTo, setNewTo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const byPhone = useMemo(() => new Map(people.filter((p) => p.phone).map((p) => [last10(p.phone), p])), [people]);
  const threads = useMemo(() => {
    const map = new Map<string, Text[]>();
    for (const t of texts) {
      const other = t.direction === "inbound" ? t.from_number : t.to_number;
      map.set(other, [...(map.get(other) ?? []), t]);
    }
    const q = search.trim().toLowerCase();
    return [...map.entries()].map(([number, list]) => ({ number, list, person: byPhone.get(last10(number)) ?? null, unread: list.filter((t) => t.direction === "inbound" && !t.read_at).length }))
      .filter((t) => !q || `${t.number} ${t.person?.name ?? ""} ${t.list[0].body}`.toLowerCase().includes(q));
  }, [texts, byPhone, search]);
  const thread = threads.find((t) => t.number === openNumber) ?? null;
  const to = newTo ?? openNumber;
  const person = to ? byPhone.get(last10(to)) ?? null : null;
  const optedOut = to ? optOuts.includes(to) : false;

  const open = (number: string, unread: number) => {
    setOpenNumber(number); setNewTo(null); setDraft("");
    if (unread && !readOnly) start(async () => { await markThreadRead(number); });
  };
  const send = () => start(async () => {
    const res = await sendText({ to: to!, body: draft, contactId: person?.id });
    setMsg(res);
    if (!res.error) { setDraft(""); if (newTo !== null) setNewTo(null); } // the new thread appears in the list
  });

  if (!ready) return <EmptyState message="Texting isn't set up yet. Add the Twilio settings in Coolify (see the setup notes) and this tab comes alive." />;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className={cn("min-w-0 space-y-2", (thread || newTo !== null) && "hidden lg:block")}>
        <div className="flex gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search texts…" />
          {!readOnly && <Button onClick={() => { setNewTo(""); setOpenNumber(null); }}><Plus /> New</Button>}
        </div>
        {threads.length === 0 ? <EmptyState message="No texts yet." /> : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {threads.map((t) => (
              <li key={t.number}>
                <button type="button" onClick={() => open(t.number, t.unread)} className={cn("w-full p-3 text-left hover:bg-muted/40", openNumber === t.number && "bg-accent/60")}>
                  <span className="flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-sm", t.unread && "font-semibold")}>{t.person?.name ?? t.number}</span>
                    {t.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{t.unread}</span>}
                    <span className="text-[11px] text-muted-foreground">{when(t.list[0].created_at)}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t.list[0].direction === "outbound" ? "You: " : ""}{t.list[0].body || "(attachment)"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cn("min-w-0", !(thread || newTo !== null) && "hidden lg:block")}>
        {newTo === null && !thread ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-sm text-muted-foreground"><MessageSquare className="size-6" />Select a conversation</div>
        ) : (
          <div className="flex h-[70dvh] flex-col rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b p-3">
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back" onClick={() => { setOpenNumber(null); setNewTo(null); }}><ArrowLeft /></Button>
              {newTo !== null ? (
                <Input autoFocus value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="Phone number, e.g. (480) 555-0142" list="text-people" className="h-8" aria-label="To" />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{person?.name ?? thread!.number}</p>
                  {person && <p className="text-xs text-muted-foreground">{thread!.number}</p>}
                </div>
              )}
              {person && <Link href={`/admin/contacts/${person.id}`} className="text-xs text-primary hover:underline">Contact</Link>}
              {to && newTo === null && <Button variant="outline" size="icon-sm" aria-label="Call" onClick={() => startCall({ number: to, name: person?.name, contactId: person?.id })}><Phone /></Button>}
              <datalist id="text-people">{people.filter((p) => p.phone).map((p) => <option key={p.id} value={p.phone!}>{p.name}</option>)}</datalist>
            </div>
            <div className="flex flex-1 flex-col-reverse gap-2 overflow-y-auto p-3">
              {(thread?.list ?? []).map((t) => (
                <div key={t.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", t.direction === "outbound" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted")}>
                  <p className="break-words whitespace-pre-wrap">{t.body}</p>
                  {t.media.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs opacity-80"><Paperclip className="size-3" /> {t.media.length} attachment{t.media.length > 1 ? "s" : ""}</p>}
                  <p className={cn("mt-1 text-[10px]", t.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {when(t.created_at)}{t.direction === "outbound" && t.status ? ` · ${t.status}` : ""}{t.error ? ` · ${t.error}` : ""}
                  </p>
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="space-y-2 border-t p-3">
                {optedOut && <Badge variant="outline" className="text-destructive">Replied STOP. They need to text START first.</Badge>}
                <div className="flex items-end gap-2">
                  <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Text message" maxLength={1600} aria-label="Message"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim() && to) send(); }} />
                  <Button disabled={pending || !draft.trim() || !to || optedOut} onClick={send} aria-label="Send"><Send /></Button>
                </div>
                <p className="flex justify-between text-[11px] text-muted-foreground"><span>{msg.error ?? msg.ok ?? "Ctrl+Enter to send"}</span><span>{draft.length}/1600</span></p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
