"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { importProspects, updateProspect } from "@/lib/admin/actions/prospects";
import { prettyPhone, prospectE164 } from "@/lib/prospects/phone";
import type { Prospect } from "@/lib/prospects/types";
import { cn } from "@/lib/utils";

// Add one business, or edit one, with the same details a CRM contact has
// (business, contact person, full address), so Send to Leads carries
// everything over. Only the phone number is required.

type F = { name: string; label: string; placeholder?: string; wide?: boolean; type?: string; max?: number };
const Section = ({ title }: { title: string }) => <p className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">{title}</p>;

function Field({ f, value }: { f: F; value?: string | number | null }) {
  return (
    <div className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
      <Label htmlFor={`ap-${f.name}`}>{f.label}</Label>
      <Input id={`ap-${f.name}`} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} defaultValue={value ?? ""} maxLength={f.max ?? 200} />
    </div>
  );
}

export function AddProspectPanel({ onClose, prospect }: { onClose: () => void; prospect?: Prospect }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const p = prospect;

  const submit = (form: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (v.phone_ext && !/^[0-9]{1,8}$/.test(v.phone_ext)) { setError("The extension can only be numbers."); return; }
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) { setError("That email address doesn't look right."); return; }
    if (!p && !prospectE164(v.phone ?? "")) { setError("Enter a valid US business phone number."); return; }
    start(async () => {
      if (p) {
        const r = await updateProspect(p.id, v);
        if (r.error) { setError(r.error); return; }
      } else {
        const r = await importProspects([{ ...v, phone: v.phone }], "manual");
        if (r.error) { setError(r.error); return; }
        if (!r.added) { setError("That number is already on the list."); return; }
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title={p ? `Edit ${p.business_name ?? prettyPhone(p.phone_e164)}` : "Add a prospect"} id="prospects-add" defaultWidth={560}
      description={p ? undefined : "A business number to call on. Only the phone number is required."}
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-prospect-form" disabled={pending}>{pending ? "Saving…" : p ? "Save" : "Add prospect"}</Button>
        </div>
      }>
      <form id="add-prospect-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setError(undefined); submit(e.currentTarget); }}>
        <Section title="Business" />
        <Field f={{ name: "business_name", label: "Business name", placeholder: "e.g. Acme Plumbing", wide: true }} value={p?.business_name} />
        <Field f={{ name: "category", label: "Category", placeholder: "e.g. HVAC, dental, law" }} value={p?.category} />
        <Field f={{ name: "locations", label: "Number of locations", type: "number", placeholder: "1", max: 6 }} value={p?.locations} />
        <Field f={{ name: "website", label: "Website", placeholder: "https://", wide: true, max: 300 }} value={p?.website} />

        <Section title="Phone" />
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 sm:col-span-2">
          <div className="space-y-1.5">
            <Label htmlFor="ap-phone">Phone {!p && <span className="text-destructive">*</span>}</Label>
            {p
              ? <Input id="ap-phone" value={prettyPhone(p.phone_e164)} disabled />
              : <PhoneInput id="ap-phone" name="phone" required />}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-phone_ext">Ext.</Label>
            <Input id="ap-phone_ext" name="phone_ext" inputMode="numeric" pattern="[0-9]*" maxLength={8} placeholder="5" defaultValue={p?.phone_ext ?? ""} />
          </div>
        </div>

        <Section title="Contact person (optional)" />
        <Field f={{ name: "contact_first_name", label: "First name" }} value={p?.contact_first_name} />
        <Field f={{ name: "contact_last_name", label: "Last name" }} value={p?.contact_last_name} />
        <Field f={{ name: "contact_title", label: "Job title", placeholder: "e.g. Owner, Office manager" }} value={p?.contact_title} />
        <Field f={{ name: "email", label: "Email", type: "email" }} value={p?.email} />

        <Section title="Address" />
        <Field f={{ name: "address", label: "Street address", placeholder: "123 Main St", max: 300 }} value={p?.address} />
        <Field f={{ name: "address2", label: "Suite, unit or building", placeholder: "Suite 200", max: 100 }} value={p?.address2} />
        <Field f={{ name: "city", label: "City", placeholder: "Chandler", max: 100 }} value={p?.city} />
        <div className="grid grid-cols-2 gap-2">
          <Field f={{ name: "state", label: "State", placeholder: "AZ", max: 60 }} value={p?.state} />
          <Field f={{ name: "zip", label: "ZIP", max: 20 }} value={p?.zip} />
        </div>
        <Field f={{ name: "country", label: "Country", placeholder: "United States", max: 60 }} value={p?.country} />

        <Section title="Notes" />
        <Field f={{ name: "tags", label: "Tags", placeholder: "Comma separated", wide: true, max: 400 }} value={p?.tags?.join(", ")} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ap-notes">Notes</Label>
          <Textarea id="ap-notes" name="notes" rows={3} defaultValue={p?.notes ?? ""} placeholder="Who you spoke to, contract end date, next step…" />
        </div>
      </form>
    </ResponsivePanel>
  );
}
