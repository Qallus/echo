"use client";

import { useRouter } from "next/navigation";
import { saveCompany, saveContact, saveDeal, type CompanyInput, type ContactInput, type DealInput } from "@/lib/admin/actions/crm";
import { OPPORTUNITY_TYPES } from "@/lib/crm/deals";
import { COMPANY_STATUSES, CONTACT_ROLES, DEAL_STAGES, LEAD_STATUSES, type ContactRole, contactName, type Company, type Contact, type Deal, type StaffOption } from "@/lib/crm/types";
import { Field, RecordDialog, SelectField } from "./crm-ui";

// Add and edit forms for clients, contacts and deals. A new record opens its
// page unless `stay` is set (e.g. adding a contact from a client's page).

type Common = { open: boolean; onOpenChange: (open: boolean) => void; staff: StaffOption[]; stay?: boolean };

const owners = (staff: StaffOption[]) => staff.map((s) => ({ value: s.user_id, label: s.name }));

export function CompanyDialog({ company, ...p }: Common & { company?: Company }) {
  const router = useRouter();
  return (
    <RecordDialog title={company ? `Edit ${company.name}` : "New client"} submitLabel={company ? "Save" : "Add client"} open={p.open} onOpenChange={p.onOpenChange}
      onSubmit={async (v) => {
        const res = await saveCompany(company?.id ?? null, v as unknown as CompanyInput);
        if (res.id && !company && !p.stay) router.push(`/admin/clients/${res.id}`);
        return res;
      }}>
      <Field label="Name" name="name" defaultValue={company?.name} required className="sm:col-span-2" />
      <SelectField label="Status" name="status" defaultValue={company?.status ?? "prospect"} options={COMPANY_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
      <SelectField label="Owner" name="owner_id" defaultValue={company?.owner_id} options={owners(p.staff)} empty="Unassigned" />
      <Field label="Website" name="website" defaultValue={company?.website} placeholder="https://" />
      <Field label="Industry" name="industry" defaultValue={company?.industry} />
      <Field label="Email" name="email" type="email" defaultValue={company?.email} />
      <Field label="Phone" name="phone" type="tel" defaultValue={company?.phone} />
      <Field label="Address" name="address" defaultValue={company?.address} className="sm:col-span-2" />
      <Field label="Tags" name="tags" defaultValue={company?.tags.join(", ")} placeholder="Comma separated" className="sm:col-span-2" />
      <Field label="Notes" name="notes" defaultValue={company?.notes} multiline className="sm:col-span-2" />
    </RecordDialog>
  );
}

export function ContactDialog({ contact, companies, companyId, role, ...p }: Common & { contact?: Contact; companies: { id: string; name: string }[]; companyId?: string; role?: ContactRole }) {
  const router = useRouter();
  return (
    <RecordDialog title={contact ? `Edit ${contactName(contact)}` : role === "lead" ? "New lead" : "New contact"} submitLabel={contact ? "Save" : role === "lead" ? "Add lead" : "Add contact"} open={p.open} onOpenChange={p.onOpenChange}
      onSubmit={async (v) => {
        const res = await saveContact(contact?.id ?? null, v as unknown as ContactInput);
        if (res.id && !contact && !p.stay) router.push(`/admin/contacts/${res.id}`);
        return res;
      }}>
      <Field label="First name" name="first_name" defaultValue={contact?.first_name} required />
      <Field label="Last name" name="last_name" defaultValue={contact?.last_name} />
      <Field label="Email" name="email" type="email" defaultValue={contact?.email} />
      <Field label="Phone" name="phone" type="tel" defaultValue={contact?.phone} />
      <Field label="Job title" name="title" defaultValue={contact?.title} />
      <SelectField label="Client" name="company_id" defaultValue={contact?.company_id ?? companyId} options={companies.map((c) => ({ value: c.id, label: c.name }))} empty="None" />
      <SelectField label="Role" name="role" defaultValue={contact?.role ?? role ?? "contact"} options={CONTACT_ROLES.map((r) => ({ value: r.id, label: r.label }))} />
      <SelectField label="Lead status" name="lead_status" defaultValue={contact?.lead_status ?? (role === "lead" ? "new" : "")} options={LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label }))} empty="None" />
      <Field label="Source" name="source" defaultValue={contact?.source} placeholder="Referral, website, event…" />
      <SelectField label="Owner" name="owner_id" defaultValue={contact?.owner_id} options={owners(p.staff)} empty="Unassigned" />
      <Field label="Interest" name="interest" defaultValue={contact?.interest} placeholder="What they asked about" />
      <Field label="Website" name="website" defaultValue={contact?.website} placeholder="https://" />
      <Field label="City" name="city" defaultValue={contact?.city} />
      <Field label="State" name="state" defaultValue={contact?.state} />
      <Field label="Tags" name="tags" defaultValue={contact?.tags.join(", ")} placeholder="Comma separated" className="sm:col-span-2" />
      <Field label="Notes" name="notes" defaultValue={contact?.notes} multiline className="sm:col-span-2" />
    </RecordDialog>
  );
}

export function DealDialog({ deal, companies, contacts, defaults, ...p }: Common & {
  deal?: Deal; companies: { id: string; name: string }[]; contacts: Contact[]; defaults?: { company_id?: string; contact_id?: string };
}) {
  const router = useRouter();
  return (
    <RecordDialog title={deal ? `Edit ${deal.title}` : "New deal"} submitLabel={deal ? "Save" : "Add deal"} open={p.open} onOpenChange={p.onOpenChange}
      onSubmit={async (v) => {
        const res = await saveDeal(deal?.id ?? null, v as unknown as DealInput);
        if (res.id && !deal && !p.stay) router.push(`/admin/pipeline/${res.id}`);
        return res;
      }}>
      <Field label="Deal name" name="title" defaultValue={deal?.title} required placeholder="e.g. Acme: Business plan, 12 seats" className="sm:col-span-2" />
      <SelectField label="Stage" name="stage" defaultValue={deal?.stage ?? "lead"} options={DEAL_STAGES.map((s) => ({ value: s.id, label: s.label }))} />
      <Field label="Value (USD)" name="value" defaultValue={deal ? String(deal.value_cents / 100) : ""} placeholder="0" type="text" />
      <SelectField label="Client" name="company_id" defaultValue={deal?.company_id ?? defaults?.company_id} options={companies.map((c) => ({ value: c.id, label: c.name }))} empty="None" />
      <SelectField label="Contact" name="contact_id" defaultValue={deal?.contact_id ?? defaults?.contact_id}
        options={contacts.map((c) => ({ value: c.id, label: `${contactName(c)}${c.company ? ` · ${c.company.name}` : ""}` }))} empty="None" />
      <Field label="Expected close" name="expected_close" type="date" defaultValue={deal?.expected_close} />
      <SelectField label="Owner" name="owner_id" defaultValue={deal?.owner_id} options={owners(p.staff)} empty="Unassigned" />
      <Field label="Next step" name="next_step" defaultValue={deal?.next_step} placeholder="e.g. Send proposal" />
      <Field label="Next step due" name="next_step_due" type="date" defaultValue={deal?.next_step_due} />
      <Field label="Source" name="source" defaultValue={deal?.source} />
      <SelectField label="Type" name="opportunity_type" defaultValue={deal?.opportunity_type} options={OPPORTUNITY_TYPES.map((t) => ({ value: t, label: t }))} empty="Choose…" />
      <Field label="Products" name="products" defaultValue={deal?.products.join(", ")} placeholder="Business plan, Minute pack" />
      <Field label="Notes" name="notes" defaultValue={deal?.notes} multiline className="sm:col-span-2" />
    </RecordDialog>
  );
}
