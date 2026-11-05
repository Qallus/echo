"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { addDirectoryEntry, removeDirectoryEntry } from "@/lib/redial/actions";
import type { DirectoryEntry } from "@/lib/redial/data";
import { FEATURES } from "@/lib/redial/features";
import { prettyNumber } from "./calls-view";

// Directory: the people and numbers a live call can be transferred to. The
// note is read to them in the briefing before they press 1.
export function DirectorySettings({ lineId, entries, canEdit }: { lineId: string; entries: DirectoryEntry[]; canEdit: boolean }) {
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        {FEATURES.directory.name}: who a live call can be transferred to. They hear who&apos;s calling and why, then press 1 to take it. If they don&apos;t, the caller stays with your assistant.
      </p>
      {canEdit && (
        <form className="space-y-3 rounded-xl border p-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => { const r = await addDirectoryEntry(lineId, label, number, note); setMsg(r); if (r.ok) { setLabel(""); setNumber(""); setNote(""); } });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="dir-label">Name</Label><Input id="dir-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Office manager" maxLength={80} required /></div>
            <div className="space-y-1.5"><Label htmlFor="dir-number">Phone number</Label><PhoneInput id="dir-number" value={number} onChange={setNumber} required /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir-note">Briefing note (optional)</Label>
            <Input id="dir-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Read to them before they accept, e.g. Usually a customer with a billing question." maxLength={300} />
          </div>
          <Button type="submit" size="sm" disabled={pending}><Plus /> Add</Button>
          {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        </form>
      )}
      {entries.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No transfer destinations yet.</p> : (
        <ul className="divide-y rounded-xl border bg-card">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.label} <span className="font-normal text-muted-foreground">· {prettyNumber(e.number)}</span></p>
                {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.label}`} disabled={pending}
                  onClick={() => { if (confirm(`Remove ${e.label} from the directory?`)) start(async () => setMsg(await removeDirectoryEntry(e.id))); }}><Trash2 /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
