"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { importProspects } from "@/lib/admin/actions/prospects";
import { prospectE164 } from "@/lib/prospects/phone";

const FIELDS: { name: string; label: string; placeholder?: string; wide?: boolean }[] = [
  { name: "business_name", label: "Business name", placeholder: "e.g. Acme Plumbing", wide: true },
  { name: "category", label: "Category", placeholder: "e.g. HVAC, dental, law" },
  { name: "website", label: "Website", placeholder: "acme.com" },
  { name: "address", label: "Street address", wide: true },
  { name: "city", label: "City", placeholder: "Chandler" },
  { name: "state", label: "State", placeholder: "AZ" },
];

// One business at a time (for a list, use Import).
export function AddProspectPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = (form: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (!prospectE164(v.phone ?? "")) { setError("Enter a valid US business phone number."); return; }
    start(async () => {
      const r = await importProspects([{ ...v, phone: v.phone }], "manual");
      if (r.error) { setError(r.error); return; }
      if (!r.added) { setError("That number is already on the list."); return; }
      router.refresh();
      onClose();
    });
  };

  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title="Add a prospect" id="prospects-add" defaultWidth={520}
      description="A business number to call on. Only the phone number is required."
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-prospect-form" disabled={pending}>{pending ? "Adding…" : "Add prospect"}</Button>
        </div>
      }>
      <form id="add-prospect-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setError(undefined); submit(e.currentTarget); }}>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ap-phone">Phone <span className="text-destructive">*</span></Label>
          <PhoneInput id="ap-phone" name="phone" required />
        </div>
        {FIELDS.map((f) => (
          <div key={f.name} className={f.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
            <Label htmlFor={`ap-${f.name}`}>{f.label}</Label>
            <Input id={`ap-${f.name}`} name={f.name} placeholder={f.placeholder} maxLength={f.name === "website" || f.name === "address" ? 300 : 200} />
          </div>
        ))}
      </form>
    </ResponsivePanel>
  );
}
