"use client";

import { useState, useTransition } from "react";
import { PhoneForwarded } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { transferCall, type LiveTransfer } from "@/lib/redial/actions";
import type { DirectoryEntry } from "@/lib/redial/data";
import { FEATURES } from "@/lib/redial/features";
import { normalizeNumber } from "@/lib/redial/types";
import { prettyNumber } from "./calls-view";

// Directory on the live card: pick a saved destination (or, with permission,
// a one-time number after confirming it). The status is what actually
// happened: calling, connected, or that it didn't go through.
export function TransferCall({ callId, assistant, directory, canCustom, transfers }: {
  callId: string; assistant: string; directory: DirectoryEntry[]; canCustom: boolean; transfers: LiveTransfer[];
}) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = transfers.at(-1);
  const busy = latest && ["ringing", "accepted", "connected"].includes(latest.status);

  const send = (to: Parameters<typeof transferCall>[1]) => {
    setError(null);
    start(async () => { const r = await transferCall(callId, to); if (r.error) setError(r.error); else setOpen(false); });
  };

  return (
    <div className="space-y-2">
      {latest && <p className="text-xs" role="status">{statusText(latest, assistant)}</p>}
      {!busy && (open ? (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-xs font-medium">Transfer the caller to</p>
          {directory.length ? (
            <div className="flex flex-wrap gap-1.5">
              {directory.map((d) => (
                <Button key={d.id} size="sm" variant="outline" disabled={pending} onClick={() => send({ destinationId: d.id })} title={prettyNumber(d.number)}>{d.label}</Button>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">No saved destinations. Add them under the Directory tab.</p>}
          {canCustom && (
            <form className="flex items-end gap-2" onSubmit={(e) => {
              e.preventDefault();
              const n = normalizeNumber(number);
              if (!n) { setError("Enter a valid phone number."); return; }
              if (confirm(`Transfer the caller to ${prettyNumber(n)}? This number isn't in your directory.`)) send({ number: n, confirmed: true });
            }}>
              <div className="flex-1 space-y-1"><label htmlFor={`xfer-${callId}`} className="text-xs text-muted-foreground">Or a one-time number</label><PhoneInput id={`xfer-${callId}`} value={number} onChange={setNumber} /></div>
              <Button type="submit" size="sm" variant="outline" disabled={pending || !number}>Transfer</Button>
            </form>
          )}
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} title={FEATURES.directory.detail}><PhoneForwarded /> {FEATURES.directory.action}</Button>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function statusText(t: LiveTransfer, assistant: string) {
  switch (t.status) {
    case "ringing": return `Calling ${t.label}… they'll hear who's calling and press 1 to take it.`;
    case "accepted": return `${t.label} accepted. Connecting…`;
    case "connected": return `Connected to ${t.label}. ${assistant} has left the call.`;
    case "ended": return `${t.label} took the call.`;
    case "no_answer": return `${t.label} didn't answer. The caller is still on the line.`;
    case "declined": return `${t.label} didn't take the call. The caller is still on the line.`;
    default: return `The transfer to ${t.label} didn't go through. The caller is still on the line.`;
  }
}
