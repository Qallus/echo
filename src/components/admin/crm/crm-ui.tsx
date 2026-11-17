"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { money } from "@/lib/billing/catalog";
import { stageOf, type Deal, type DealStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";

// Shared pieces for the CRM pages.


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
  // Like a native select: an unknown default falls back to the first option.
  const all = empty !== undefined ? [{ value: "", label: empty }, ...options] : options;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Pick id={`f-${name}`} name={name} label={label} options={all}
        defaultValue={all.some((o) => o.value === (defaultValue ?? "")) ? (defaultValue ?? "") : all[0]?.value} />
    </div>
  );
}

// A record form in a side panel (a bottom sheet on phones): collects the
// fields as a plain object and hands them to a server action; closes on
// success. The Save button sits in the panel's sticky footer.
export function RecordDialog({ title, description, open, onOpenChange, submitLabel, onSubmit, children, panelId = "crm-record" }: {
  title: string; description?: string; open: boolean; onOpenChange: (open: boolean) => void; submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<{ ok?: string; error?: string; id?: string }>; children: React.ReactNode; panelId?: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const formId = useId();
  return (
    <ResponsivePanel id={panelId} title={title} description={description} open={open} onOpenChange={(o) => { setError(undefined); onOpenChange(o); }}
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        </div>
      }>
      <form id={formId} className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
        start(async () => {
          const res = await onSubmit(values);
          if (res.error) setError(res.error);
          else onOpenChange(false);
        });
      }}>
        {children}
      </form>
    </ResponsivePanel>
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
