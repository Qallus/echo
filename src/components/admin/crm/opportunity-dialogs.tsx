"use client";

import { useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { moveDeal } from "@/lib/admin/actions/crm";
import { updateDeal } from "@/lib/admin/actions/crm-pipeline";
import { LOST_REASONS, NEXT_STEP_TYPES, newId, type CustomField, type CustomFieldType } from "@/lib/crm/deals";
import type { Deal } from "@/lib/crm/types";

type Close = () => void;

function Footer({ onClose, onSave, pending, label, disabled, extra }: { onClose: Close; onSave: () => void; pending: boolean; label: string; disabled?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2">
      {extra}
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={onSave} disabled={pending || disabled}>{pending ? "Saving…" : label}</Button>
    </div>
  );
}

export function BlockedDialog({ items, onClose }: { items: string[]; onClose: Close }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Finish this stage first" description="These steps are required before moving forward:">
        <ul className="space-y-1.5">
          {items.map((b) => <li key={b} className="flex items-start gap-2 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />{b}</li>)}
        </ul>
        <div className="flex justify-end"><Button onClick={onClose}>Got it</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// Closed Won or Closed Lost, with the summary or reason. History is kept either way.
export function CloseDialog({ deal, outcome, onClose }: { deal: Deal; outcome: "won" | "lost"; onClose: Close }) {
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const res = outcome === "won"
      ? await moveDeal(deal.id, "closed_won", { won_summary: notes })
      : await moveDeal(deal.id, "closed_lost", { lost_reason: reason, lost_notes: notes });
    if (res.error) setError(res.error); else onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={outcome === "won" ? "Mark Closed Won" : "Mark Closed Lost"}>
        {outcome === "lost" && (
          <div className="space-y-1.5"><Label htmlFor="lost-reason">Lost reason</Label>
            <Pick id="lost-reason" label="Lost reason" value={reason} onChange={(v) => setReason(v)} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} />
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="close-notes">{outcome === "won" ? "Won summary" : "Notes"}</Label>
          <Textarea id="close-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={outcome === "won" ? "What sealed it?" : "What happened?"} />
        </div>
        <p className="text-xs text-muted-foreground">The opportunity and its full history are kept either way.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Footer onClose={onClose} onSave={save} pending={pending} label="Confirm" />
      </DialogContent>
    </Dialog>
  );
}

export function NextStepDialog({ deal, onClose }: { deal: Deal; onClose: Close }) {
  const [action, setAction] = useState(deal.next_step ?? "");
  const [due, setDue] = useState(() => deal.next_step_due ?? new Date(Date.now() + 2 * 86400_000).toLocaleDateString("en-CA"));
  const [type, setType] = useState<string>(deal.next_step_type ?? "call");
  const [priority, setPriority] = useState<string>(deal.next_step_priority);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = (clear?: boolean) => start(async () => {
    const res = await updateDeal(deal.id, clear
      ? { next_step: null, next_step_due: null, next_step_type: null }
      : { next_step: action, next_step_due: due, next_step_type: type, next_step_priority: priority });
    if (res.error) setError(res.error); else onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Next step">
        <div className="space-y-1.5"><Label htmlFor="ns-action">What happens next</Label>
          <Input id="ns-action" autoFocus value={action} onChange={(e) => setAction(e.target.value)} placeholder="Send the proposal" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Due</Label><DatePicker value={due} onChange={setDue} /></div>
          <div className="space-y-1.5"><Label htmlFor="ns-type">Type</Label>
            <Pick id="ns-type" label="Type" value={type} onChange={(v) => setType(v)} options={NEXT_STEP_TYPES.map((t) => ({ value: t.key, label: t.label }))} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="ns-pri">Priority</Label>
            <Pick id="ns-pri" label="Priority" value={priority} onChange={(v) => setPriority(v)}
              options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">An open opportunity with no future next step is flagged in its header.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Footer onClose={onClose} onSave={() => save()} pending={pending} label="Save next step" disabled={!action.trim() || !due}
          extra={deal.next_step ? <Button variant="outline" disabled={pending} onClick={() => save(true)}>Clear</Button> : null} />
      </DialogContent>
    </Dialog>
  );
}

// A field the team adds to Key fields for this opportunity (PO number, seats…).
export function AddFieldDialog({ deal, onClose }: { deal: Deal; onClose: Close }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const taken = deal.custom_fields.some((f) => f.label.toLowerCase() === label.trim().toLowerCase());
  const save = () => start(async () => {
    const field: CustomField = { id: newId("fld"), label: label.trim(), type, value: "" };
    const res = await updateDeal(deal.id, { custom_fields: [...deal.custom_fields, field] });
    if (res.error) setError(res.error); else onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add a field" description="Shown under Key fields on this opportunity.">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div className="space-y-1.5"><Label htmlFor="fld-label">Label</Label><Input id="fld-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="PO number" /></div>
          <div className="space-y-1.5"><Label htmlFor="fld-type">Type</Label>
            <Pick id="fld-type" label="Type" value={type} onChange={(v) => setType(v as CustomFieldType)}
              options={[{ value: "text", label: "Text" }, { value: "number", label: "Number" }, { value: "date", label: "Date" }]} />
          </div>
        </div>
        {taken && <p className="text-sm text-destructive">There&apos;s already a field with that name.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Footer onClose={onClose} onSave={save} pending={pending} label="Add field" disabled={!label.trim() || taken} />
      </DialogContent>
    </Dialog>
  );
}
