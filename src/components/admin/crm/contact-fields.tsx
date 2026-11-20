"use client";

import { useState } from "react";
import { Building2, Check, UserRound, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick, type PickOption } from "@/components/ui/pick";
import { CONTACT_KINDS, CONTACT_ROLES, CONTACT_SOURCES, LEAD_STATUSES, type Contact, type ContactKind, type ContactRole, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { Field, SelectField } from "./crm-ui";
import { ImageField } from "./image-field";

// The fields of the New / Edit contact form. A contact is a person, a
// business, or both: a person gets a photo, a business gets a logo, a
// business name and how many locations it has; "Both" gets all of it.
// Picking "Referral" as the source asks who referred them.

const KIND_ICONS = { person: UserRound, business: Building2, both: Users } as const;
const KIND_HINTS = { person: "Someone you know or sell to", business: "A company, no specific person", both: "A person and their business" } as const;

// Sources in groups; a saved value not in the list shows as "Other".
const SOURCE_GROUPS: Record<string, readonly string[]> = {
  "People": ["Referral", "Partner", "In person", "Event", "Self-generated"],
  "Search and social": ["Google", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "X (Twitter)", "Other social media"],
  "Marketing": ["Website", "Email campaign", "Print", "Direct mail", "Direct", "Cold call"],
};
const SOURCE_OPTIONS: PickOption[] = [
  { value: "", label: "Not set" },
  ...Object.entries(SOURCE_GROUPS).flatMap(([group, items]) => items.map((s) => ({ value: s, label: s, group }))),
  { value: "Other", label: "Other…", group: "Other" },
];
const KNOWN = new Set<string>(CONTACT_SOURCES);

function Section({ title }: { title: string }) {
  return <p className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">{title}</p>;
}

export function ContactFields({ contact, companies, companyId, role, staff }: {
  contact?: Contact; companies: { id: string; name: string }[]; companyId?: string; role?: ContactRole; staff: StaffOption[];
}) {
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? "person");
  const saved = contact?.source ?? "";
  const [source, setSource] = useState(!saved || KNOWN.has(saved) ? saved : "Other");
  const business = kind !== "person";
  const person = kind !== "business";
  const refd = contact?.referral ?? {};
  // A business-only contact stores its business name as the first name; don't show it twice.
  const firstName = contact?.kind === "business" && contact.first_name === contact.company_name ? "" : contact?.first_name;

  return (
    <>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>This contact is</Label>
        <input type="hidden" name="kind" value={kind} />
        <div role="radiogroup" aria-label="Contact type" className="grid grid-cols-3 gap-2">
          {CONTACT_KINDS.map((k) => {
            const on = k.id === kind;
            const Icon = KIND_ICONS[k.id];
            return (
              <button key={k.id} type="button" role="radio" aria-checked={on} onClick={() => setKind(k.id)}
                className={cn("relative flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors",
                  on ? "border-foreground bg-muted/60 ring-1 ring-foreground" : "hover:bg-muted/40")}>
                <span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="size-4" />{k.label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{KIND_HINTS[k.id]}</span>
                {on && <Check className="absolute top-2 right-2 size-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("grid gap-3 sm:col-span-2", kind === "both" && "sm:grid-cols-2")}>
        {person && <ImageField key="photo" name="photo" label="Photo" kind="photo" defaultValue={contact?.photo} />}
        {business && <ImageField key="logo" name="logo" label="Business logo" kind="logo" defaultValue={contact?.logo} />}
      </div>

      {business && <Section title="Business" />}
      {business && <Field label="Business name" name="company_name" defaultValue={contact?.company_name} required className="sm:col-span-2" />}
      {business && <Field label="Number of locations" name="locations" type="number" defaultValue={contact?.locations ? String(contact.locations) : ""} placeholder="1" />}
      {business && <Field label="Website" name="website" defaultValue={contact?.website} placeholder="https://" />}

      <Section title={kind === "business" ? "Contact person (optional)" : "Person"} />
      <Field label="First name" name="first_name" defaultValue={firstName} required={person} />
      <Field label="Last name" name="last_name" defaultValue={contact?.last_name} />
      <Field label="Job title" name="title" defaultValue={contact?.title} />
      {kind === "person"
        ? <Field label="Company name" name="company_name" defaultValue={contact?.company_name} placeholder="Where they work" />
        : <Field label="Email" name="email" type="email" defaultValue={contact?.email} />}
      {kind === "person" && <Field label="Email" name="email" type="email" defaultValue={contact?.email} />}
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 sm:col-span-1">
        <Field label="Phone" name="phone" type="tel" defaultValue={contact?.phone} />
        <div className="space-y-1.5">
          <Label htmlFor="f-phone_ext">Ext.</Label>
          <Input id="f-phone_ext" name="phone_ext" inputMode="numeric" pattern="[0-9]*" maxLength={8} defaultValue={contact?.phone_ext ?? ""} placeholder="5" />
        </div>
      </div>
      {kind === "person" && <Field label="Website" name="website" defaultValue={contact?.website} placeholder="https://" />}

      <Section title="Address" />
      <Field label="Street address" name="address" defaultValue={contact?.address} placeholder="123 Main St" />
      <Field label="Suite, unit or floor" name="address2" defaultValue={contact?.address2} placeholder="Suite 200" />
      <Field label="City" name="city" defaultValue={contact?.city} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="State" name="state" defaultValue={contact?.state} placeholder="AZ" />
        <Field label="ZIP" name="zip" defaultValue={contact?.zip} />
      </div>
      <Field label="Country" name="country" defaultValue={contact?.country} placeholder="United States" />

      <Section title="In the CRM" />
      <SelectField label="Client" name="company_id" defaultValue={contact?.company_id ?? companyId} options={companies.map((c) => ({ value: c.id, label: c.name }))} empty="None" />
      <SelectField label="Owner" name="owner_id" defaultValue={contact?.owner_id} options={staff.map((s) => ({ value: s.user_id, label: s.name }))} empty="Unassigned" />
      <SelectField label="Role" name="role" defaultValue={contact?.role ?? role ?? "contact"} options={CONTACT_ROLES.map((r) => ({ value: r.id, label: r.label }))} />
      <SelectField label="Lead status" name="lead_status" defaultValue={contact?.lead_status ?? (role === "lead" ? "new" : "")} options={LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label }))} empty="None" />
      <div className="space-y-1.5">
        <Label htmlFor="f-source">Source</Label>
        <Pick id="f-source" name="source" label="Source" options={SOURCE_OPTIONS} value={source} onChange={setSource} />
      </div>
      <Field label="Interest" name="interest" defaultValue={contact?.interest} placeholder="What they asked about" />
      {source === "Other" && <Field label="Where did they come from?" name="source_other" defaultValue={KNOWN.has(saved) ? "" : saved} placeholder="e.g. Radio ad, Chamber of Commerce" className="sm:col-span-2" />}

      {source === "Referral" && (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:col-span-2 sm:grid-cols-2">
          <p className="text-sm font-medium sm:col-span-2">Who referred them?</p>
          <Field label="First name" name="ref_first_name" defaultValue={refd.first_name} />
          <Field label="Last name" name="ref_last_name" defaultValue={refd.last_name} />
          <Field label="Phone" name="ref_phone" type="tel" defaultValue={refd.phone} />
          <Field label="Email" name="ref_email" type="email" defaultValue={refd.email} />
        </div>
      )}

      <Field label="Tags" name="tags" defaultValue={contact?.tags.join(", ")} placeholder="Comma separated" className="sm:col-span-2" />
      <Field label="Notes" name="notes" defaultValue={contact?.notes} multiline className="sm:col-span-2" />
    </>
  );
}
