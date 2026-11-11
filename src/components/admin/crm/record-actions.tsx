"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { deleteCompany, deleteContact, deleteDeal, moveDeal } from "@/lib/admin/actions/crm";
import { DEAL_STAGES, contactName, type Company, type Contact, type Deal, type DealStage, type StaffOption } from "@/lib/crm/types";
import { CompanyDialog, ContactDialog, DealDialog } from "./record-dialogs";

type Ref = { id: string; name: string };

// Edit and Delete for a record's page header; Delete returns to the list.
function HeaderActions({ label, onDelete, back, children, editing, setEditing }: {
  label: string; onDelete: () => Promise<{ error?: string }>; back: string; children: React.ReactNode; editing: boolean; setEditing: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} disabled={pending}
        onClick={() => confirm(`Delete ${label}? This can't be undone.`) && start(async () => {
          const res = await onDelete();
          if (res.error) alert(res.error);
          else router.push(back);
        })}><Trash2 /></Button>
      {editing && children}
    </div>
  );
}

export function CompanyActions({ company, staff }: { company: Company; staff: StaffOption[] }) {
  const [editing, setEditing] = useState(false);
  return (
    <HeaderActions label={company.name} back="/admin/clients" onDelete={() => deleteCompany(company.id)} editing={editing} setEditing={setEditing}>
      <CompanyDialog open onOpenChange={setEditing} company={company} staff={staff} />
    </HeaderActions>
  );
}

export function ContactActions({ contact, companies, staff }: { contact: Contact; companies: Ref[]; staff: StaffOption[] }) {
  const [editing, setEditing] = useState(false);
  return (
    <HeaderActions label={contactName(contact)} back="/admin/contacts" onDelete={() => deleteContact(contact.id)} editing={editing} setEditing={setEditing}>
      <ContactDialog open onOpenChange={setEditing} contact={contact} companies={companies} staff={staff} />
    </HeaderActions>
  );
}

export function DealActions({ deal, companies, contacts, staff }: { deal: Deal; companies: Ref[]; contacts: Contact[]; staff: StaffOption[] }) {
  const [editing, setEditing] = useState(false);
  return (
    <HeaderActions label={deal.title} back="/admin/pipeline" onDelete={() => deleteDeal(deal.id)} editing={editing} setEditing={setEditing}>
      <DealDialog open onOpenChange={setEditing} deal={deal} companies={companies} contacts={contacts} staff={staff} />
    </HeaderActions>
  );
}

export function AddContactButton({ companies, staff, companyId }: { companies: Ref[]; staff: StaffOption[]; companyId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus /> {companyId ? "Add contact" : "New contact"}</Button>
      <ContactDialog open={open} onOpenChange={setOpen} companies={companies} staff={staff} companyId={companyId} stay={Boolean(companyId)} />
    </>
  );
}

export function AddCompanyButton({ staff }: { staff: StaffOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus /> New client</Button>
      <CompanyDialog open={open} onOpenChange={setOpen} staff={staff} />
    </>
  );
}

export function AddDealButton({ companies, contacts, staff, defaults }: {
  companies: Ref[]; contacts: Contact[]; staff: StaffOption[]; defaults?: { company_id?: string; contact_id?: string };
}) {
  const [open, setOpen] = useState(false);
  const stay = Boolean(defaults?.company_id || defaults?.contact_id);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus /> {stay ? "Add deal" : "New deal"}</Button>
      <DealDialog open={open} onOpenChange={setOpen} companies={companies} contacts={contacts} staff={staff} defaults={defaults} stay={stay} />
    </>
  );
}

// Quick stage change on a deal's page.
export function StageSelect({ id, stage, readOnly }: { id: string; stage: DealStage; readOnly?: boolean }) {
  const [value, setValue] = useState(stage);
  const [pending, start] = useTransition();
  return (
    <Pick value={value} disabled={readOnly || pending} label="Stage" className="w-auto" options={DEAL_STAGES.map((s) => ({ value: s.id, label: s.label }))}
      onChange={(v) => {
        const next = v as DealStage;
        setValue(next);
        start(async () => { const res = await moveDeal(id, next); if (res.error) { setValue(stage); alert(res.error); } });
      }} />
  );
}
