"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { money } from "@/lib/billing/catalog";
import { stageOf, type Deal, type DealStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";

// Shared pieces for the CRM pages.

export const SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
export const FILTER = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function StageDot({ stage, className }: { stage: DealStage; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", stageOf(stage).dot, className)} />;
}

export function StageLabel({ stage }: { stage: DealStage }) {
  return <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"><StageDot stage={stage} />{stageOf(stage).label}</span>;
}

// Label + input (or textarea / select) for record forms.
export function Field({ label, name, defaultValue, type = "text", placeholder, required, className, multiline }: {
  label: string; name: string; defaultValue?: string | null; type?: string; placeholder?: string; required?: boolean; className?: string; multiline?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      {type === "date"
        ? <DatePicker id={`f-${name}`} name={name} defaultValue={defaultValue} />
        : type === "tel"
        ? <PhoneInput id={`f-${name}`} name={name} defaultValue={defaultValue} placeholder={placeholder} />
        : multiline
        ? <Textarea id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} rows={3} />
        : <Input id={`f-${name}`} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} />}
    </div>
  );
}

export function SelectField({ label, name, defaultValue, options, empty, className }: {
  label: string; name: string; defaultValue?: string | null; options: { value: string; label: string }[]; empty?: string; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <select id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} className={SELECT}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// A modal form: collects the fields as a plain object and hands them to a
// server action; closes on success.
export function RecordDialog({ title, open, onOpenChange, submitLabel, onSubmit, children }: {
  title: string; open: boolean; onOpenChange: (open: boolean) => void; submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<{ ok?: string; error?: string; id?: string }>; children: React.ReactNode;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setError(undefined); onOpenChange(o); }}>
      <DialogContent title={title} className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const values = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
          start(async () => {
            const res = await onSubmit(values);
            if (res.error) setError(res.error);
            else onOpenChange(false);
          });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Label/value pair on a record's detail page.
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children || "—"}</dd>
    </div>
  );
}

// Compact deal list for a client's or contact's page.
export function DealRows({ deals }: { deals: Deal[] }) {
  if (!deals.length) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">No deals yet.</p>;
  return (
    <ul className="divide-y rounded-xl border">
      {deals.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
          <Link href={`/admin/pipeline/${d.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{d.title}</Link>
          <StageLabel stage={d.stage} />
          <span className="w-24 text-right tabular-nums">{money(d.value_cents, d.currency)}</span>
        </li>
      ))}
    </ul>
  );
}
