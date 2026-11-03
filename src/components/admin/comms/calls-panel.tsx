"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Delete, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, Voicemail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordingLink, updateCall } from "@/lib/admin/actions/comms-phone";
import type { PhoneCall } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { startCall } from "./softphone";
import type { PhonePerson } from "./texts-panel";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");

// Dialpad (through the browser phone) and the call log: recordings,
// transcripts, notes, and linking a call to a contact.
export function CallsPanel({ calls, people, ready, number, readOnly }: {
  calls: PhoneCall[]; people: PhonePerson[]; ready: boolean; number: string | null; readOnly: boolean;
}) {
  const [dial, setDial] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const byPhone = useMemo(() => new Map(people.filter((p) => p.phone).map((p) => [last10(p.phone), p])), [people]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const matches = useMemo(() => {
    const q = dial.trim().toLowerCase();
    return q.length < 2 ? [] : people.filter((p) => p.phone && `${p.name} ${p.phone}`.toLowerCase().includes(q)).slice(0, 5);
  }, [dial, people]);

  const play = (id: string) => start(async () => { const r = await recordingLink(id); if (r.url) setAudio((a) => ({ ...a, [id]: r.url! })); else setMsg({ error: r.error }); });
  const other = (c: PhoneCall) => (c.direction === "inbound" ? c.from_number : c.to_number);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border bg-card p-4 lg:self-start">
        <p className="text-xs text-muted-foreground">{ready ? `Calls from ${number}. Rings here when someone calls that number.` : "Calling isn't set up yet. Add the Twilio settings in Coolify (see the setup notes)."}</p>
        <div className="relative">
          <Input value={dial} onChange={(e) => setDial(e.target.value)} placeholder="Number or name" className="h-10 text-lg" aria-label="Number to call" />
          {matches.length > 0 && (
            <ul className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border bg-popover p-1 shadow-md">
              {matches.map((p) => <li key={p.id}><button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => setDial(p.phone!)}>{p.name} <span className="text-xs text-muted-foreground">{p.phone}</span></button></li>)}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => <Button key={k} variant="outline" className="h-11 text-lg" onClick={() => setDial((d) => d + k)}>{k}</Button>)}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button className="h-11 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!ready || readOnly || !dial.trim()}
            onClick={() => { const p = byPhone.get(last10(dial)); startCall({ number: dial.trim(), name: p?.name, contactId: p?.id }); }}><Phone /> Call</Button>
          <Button variant="outline" className="h-11" aria-label="Delete digit" onClick={() => setDial((d) => d.slice(0, -1))}><Delete /></Button>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
        {calls.length === 0 ? <EmptyState message="No calls yet." /> : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {calls.map((c) => {
              const person = (c.contact_id && byId.get(c.contact_id)) || byPhone.get(last10(other(c))) || null;
              const missed = c.direction === "inbound" && c.status !== "completed" && !c.voicemail;
              const Icon = c.voicemail ? Voicemail : missed ? PhoneMissed : c.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
              const expanded = openId === c.id;
              return (
                <li key={c.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <Icon className={cn("size-4 shrink-0", missed || c.voicemail ? "text-destructive" : "text-muted-foreground")} />
                    <button type="button" onClick={() => setOpenId(expanded ? null : c.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{person?.name ?? other(c) ?? "Unknown"}</span>
                      <span className="block text-xs text-muted-foreground">{when(c.created_at)} · {c.voicemail ? "Voicemail" : c.status.replace("-", " ")} · {dur(c.duration_seconds)}</span>
                    </button>
                    {c.transcript && <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">Transcript</Badge>}
                    {c.recording_path && <Button size="icon-sm" variant="ghost" aria-label="Play recording" disabled={pending} onClick={() => play(c.id)}><Play /></Button>}
                    {ready && other(c) && !readOnly && <Button size="icon-sm" variant="ghost" aria-label="Call back" onClick={() => startCall({ number: other(c)!, name: person?.name, contactId: person?.id })}><Phone /></Button>}
                  </div>
                  {audio[c.id] && <audio controls autoPlay src={audio[c.id]} className="mt-2 w-full" />}
                  {expanded && (
                    <div className="mt-3 space-y-3 border-t pt-3 text-sm">
                      {person ? <Link href={`/admin/contacts/${person.id}`} className="text-primary hover:underline">Open {person.name}</Link> : !readOnly && (
                        <label className="flex flex-wrap items-center gap-2 text-sm">Link to contact
                          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" defaultValue="" onChange={(e) => e.target.value && start(async () => setMsg(await updateCall(c.id, { contactId: e.target.value })))}>
                            <option value="">Choose…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </label>
                      )}
                      {c.transcript_status === "pending" && <p className="text-muted-foreground">Transcribing…</p>}
                      {c.transcript && <p className="max-h-72 overflow-y-auto rounded-lg border p-3 whitespace-pre-wrap">{c.transcript}</p>}
                      {!readOnly && (
                        <form onSubmit={(e) => { e.preventDefault(); const notes = String(new FormData(e.currentTarget).get("notes") ?? ""); start(async () => setMsg(await updateCall(c.id, { notes }))); }} className="flex gap-2">
                          <Input name="notes" defaultValue={c.notes ?? ""} placeholder="Notes" aria-label="Call notes" />
                          <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
                        </form>
                      )}
                    </div>
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
