"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, ExternalLink, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, Voicemail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { recordingLink, updateCall } from "@/lib/admin/actions/comms-phone";
import type { PhoneCall } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { startCall } from "./softphone";
import { DialPad, formatDial } from "@/components/phone/dialer";
import { usePhoneMode } from "@/components/phone/phone-mode";
import type { PhonePerson } from "./texts-panel";

const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");
const other = (c: PhoneCall) => (c.direction === "inbound" ? c.from_number : c.to_number);
const isMissed = (c: PhoneCall) => c.direction === "inbound" && c.status !== "completed" && !c.voicemail;
const outcome = (c: PhoneCall) => (c.voicemail ? "Voicemail" : isMissed(c) ? "Missed" : c.status.replace("-", " "));

// Dialpad (through the browser phone) and the call log: recordings,
// transcripts, notes, and linking a call to a contact.
export function CallsPanel({ calls, people, ready, number, readOnly, showPad = true, heading }: {
  calls: PhoneCall[]; people: PhonePerson[]; ready: boolean; number: string | null; readOnly: boolean;
  /** False when another dial pad is already on the page (the log only). */
  showPad?: boolean;
  heading?: string;
}) {
  const mode = usePhoneMode();
  const [dial, setDial] = useState("");
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const byPhone = useMemo(() => new Map(people.filter((p) => p.phone).map((p) => [last10(p.phone), p])), [people]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const matches = useMemo(() => {
    const q = dial.replace(/\D/g, "");
    return q.length < 3 ? [] : people.filter((p) => p.phone && p.phone.replace(/\D/g, "").includes(q)).slice(0, 3);
  }, [dial, people]);

  const play = (id: string) => start(async () => { const r = await recordingLink(id); if (r.url) setAudio((a) => ({ ...a, [id]: r.url! })); else setMsg({ error: r.error }); });
  const personOf = (c: PhoneCall) => (c.contact_id && byId.get(c.contact_id)) || byPhone.get(last10(other(c))) || null;
  const name = (c: PhoneCall) => personOf(c)?.name ?? other(c) ?? "Unknown";
  const canCall = (c: PhoneCall) => ready && !!other(c) && !readOnly;
  const callBack = (c: PhoneCall) => { const p = personOf(c); startCall({ number: other(c)!, name: p?.name, contactId: p?.id }); };
  const icon = (c: PhoneCall) => {
    const Icon = c.voicemail ? Voicemail : isMissed(c) ? PhoneMissed : c.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
    return <IconTile icon={Icon} className={cn((isMissed(c) || c.voicemail) && "text-destructive")} />;
  };

  return (
    <div className={cn("grid gap-4", showPad && "lg:grid-cols-[19rem_minmax(0,1fr)]")}>
      {showPad && (
        <div className={cn("space-y-3 md:rounded-xl md:border md:bg-card md:p-4 lg:self-start", mode === "log" && "max-md:hidden")}>
          <p className="text-center text-xs text-muted-foreground md:text-left">{ready ? `Calls from ${number}. Rings here when someone calls that number.` : "Calling isn't set up yet. Add the Twilio settings in Coolify (see the setup notes)."}</p>
          <DialPad value={dial} onChange={setDial} canCall={ready && !readOnly && dial.replace(/\D/g, "").length >= 3}
            onCall={() => { const p = byPhone.get(last10(dial)); startCall({ number: dial, name: p?.name, contactId: p?.id }); }}
            below={matches.length > 0 ? (
              <div className="flex w-full flex-wrap justify-center gap-1.5">
                {matches.map((p) => <button key={p.id} type="button" className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted-foreground/20" onClick={() => setDial(p.phone!.replace(/[^\d+]/g, ""))}>{p.name} · {formatDial(p.phone!.replace(/[^\d+]/g, ""))}</button>)}
              </div>
            ) : null} />
        </div>
      )}

      <div className={cn("min-w-0 space-y-2", mode === "pad" && "max-md:hidden")}>
        {heading && <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{heading}</h2>}
        {(msg.error || msg.ok) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        {calls.length === 0 ? <EmptyState message="No calls yet." /> : (
          <CollectionView<PhoneCall>
            items={calls} getId={(c) => c.id} title={name} noun={["call", "calls"]} storageKey="admin-calls" defaultView="list"
            subtitle={(c) => `${when(c.created_at)} · ${outcome(c)} · ${dur(c.duration_seconds)}`}
            media={icon} badge={(c) => (c.transcript ? <Badge variant="outline" className="text-[10px]">Transcript</Badge> : null)}
            meta={(c) => (c.recording_path ? "Recorded" : null)}
            searchText={(c) => `${name(c)} ${other(c) ?? ""} ${outcome(c)} ${c.notes ?? ""} ${c.transcript ?? ""}`}
            filters={[
              { id: "all", label: "All", test: () => true },
              { id: "missed", label: "Missed", test: isMissed },
              { id: "voicemail", label: "Voicemail", test: (c) => c.voicemail },
              { id: "in", label: "Incoming", test: (c) => c.direction === "inbound" },
              { id: "out", label: "Outgoing", test: (c) => c.direction === "outbound" },
              { id: "recorded", label: "Recorded", test: (c) => !!c.recording_path },
              { id: "transcript", label: "Transcript", test: (c) => !!c.transcript },
              { id: "unlinked", label: "No contact", test: (c) => !personOf(c) },
            ]}
            date={(c) => c.created_at}
            columns={[
              { id: "when", label: "When", sort: (c) => c.created_at, cell: (c) => <span className="whitespace-nowrap text-muted-foreground">{when(c.created_at)}</span> },
              { id: "who", label: "Who", sort: (c) => name(c).toLowerCase(), cell: (c) => <span className="font-medium">{name(c)}</span> },
              { id: "number", label: "Number", sort: (c) => other(c), cell: (c) => muted(other(c)) },
              { id: "direction", label: "Direction", sort: (c) => c.direction, cell: (c) => muted(c.direction === "inbound" ? "Incoming" : "Outgoing") },
              { id: "outcome", label: "Outcome", sort: outcome, cell: (c) => <span className={cn("capitalize", (isMissed(c) || c.voicemail) && "text-destructive")}>{outcome(c)}</span> },
              { id: "length", label: "Length", sort: (c) => c.duration_seconds ?? 0, cell: (c) => <span className="tabular-nums">{dur(c.duration_seconds)}</span> },
              { id: "notes", label: "Notes", cell: (c) => <span className="block max-w-56 truncate text-muted-foreground">{c.notes || "—"}</span> },
            ]}
            actions={[
              { label: "Call back", icon: Phone, single: true, show: (rows) => rows.length === 1 && canCall(rows[0]), run: ([c]) => callBack(c) },
              { label: "Copy numbers", icon: Copy, run: (rows) => { void navigator.clipboard.writeText([...new Set(rows.map(other).filter(Boolean))].join(", ")); } },
            ]}
            previewActions={(c) => <>
              {c.recording_path && <Button size="sm" variant="outline" disabled={pending} onClick={() => play(c.id)}><Play /> Play</Button>}
              {canCall(c) && <Button size="sm" variant="outline" onClick={() => callBack(c)}><Phone /> Call back</Button>}
            </>}
            preview={(c) => {
              const person = personOf(c);
              return (
                <div className="space-y-4 text-sm">
                  <DetailList rows={[
                    ["Number", other(c) ?? "—"], ["Direction", c.direction === "inbound" ? "Incoming" : "Outgoing"], ["Outcome", <span key="o" className="capitalize">{outcome(c)}</span>],
                    ["Length", dur(c.duration_seconds)], ["When", when(c.created_at)],
                  ]} />
                  {audio[c.id] && <audio controls autoPlay src={audio[c.id]} className="w-full" />}
                  {person ? <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/contacts/${person.id}`} />}><ExternalLink /> Open {person.name}</Button> : !readOnly && (
                    <div className="flex flex-wrap items-center gap-2">Link to contact
                      <Pick label="Link to contact" className="w-fit" defaultValue="" onChange={(v) => v && start(async () => setMsg(await updateCall(c.id, { contactId: v })))}
                        options={[{ value: "", label: "Choose…" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
                    </div>
                  )}
                  {c.transcript_status === "pending" && <p className="text-muted-foreground">Transcribing…</p>}
                  {c.transcript && <p className="max-h-72 overflow-y-auto rounded-lg border p-3 whitespace-pre-wrap">{c.transcript}</p>}
                  {!readOnly ? (
                    <form key={c.id} onSubmit={(e) => { e.preventDefault(); const notes = String(new FormData(e.currentTarget).get("notes") ?? ""); start(async () => setMsg(await updateCall(c.id, { notes }))); }} className="flex gap-2">
                      <Input name="notes" defaultValue={c.notes ?? ""} placeholder="Notes" aria-label="Call notes" />
                      <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
                    </form>
                  ) : c.notes && <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
