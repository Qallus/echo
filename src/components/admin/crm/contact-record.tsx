"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, GitBranchPlus, Mail, MessageSquare, Phone, Trash2, UserRound } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addToPipeline } from "@/lib/admin/actions/crm-pipeline";
import { deleteContacts, updateContact, type ContactPatch } from "@/lib/admin/actions/crm-people";
import { CONTACT_ROLES, CONTACT_STATUSES, LEAD_STATUSES, contactName, ownerName, type Activity, type Contact, type Deal, type StaffOption } from "@/lib/crm/types";
import { RoleBadge } from "./contacts-page";
import { DetailRow, Editable, Panel } from "./crm-kit";
import { DealRows } from "./crm-ui";
import { TimelinePanel } from "./timeline";

const CATEGORIES: [string, RegExp][] = [
  ["Location", /(country|city|state|zip|postal|address|street|region|location)/i],
  ["Company", /(company|employer|employees|founded|revenue|industry|hq|organization)/i],
  ["Online", /(linkedin|twitter|facebook|instagram|website|url|profile|social)/i],
  ["Person", /(name|title|department|job|role|seniority|education|email|phone)/i],
];
const categoryOf = (k: string) => CATEGORIES.find(([, re]) => re.test(k))?.[0] ?? "More details";

// One person: click-to-edit details, their deals, and the shared timeline
// (Channel-Cast's Work Lead).
export function ContactRecord({ contact, companies, deals, activities, staff, echoUserId, readOnly }: {
  contact: Contact; companies: { id: string; name: string }[]; deals: Deal[]; activities: Activity[]; staff: StaffOption[]; echoUserId: string | null; readOnly: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const save = (patch: ContactPatch) => start(async () => setMsg(await updateContact(contact.id, patch)));
  const details = Object.entries(contact.details ?? {});
  const grouped = details.reduce<Record<string, [string, string][]>>((acc, kv) => { (acc[categoryOf(kv[0])] ??= []).push(kv); return acc; }, {});
  const opt = (items: readonly { id: string; label: string }[]) => items.map((i) => ({ value: i.id, label: i.label }));
  const field = (label: string, key: keyof ContactPatch & keyof Contact) => (
    <DetailRow key={key} label={label}>{readOnly ? (contact[key] as string | null) : <Editable value={contact[key] as string | null} placeholder={`Add ${label.toLowerCase()}`} onSave={(v) => save({ [key]: v })} />}</DetailRow>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <Link href={contact.lead_status ? "/admin/leads" : "/admin/contacts"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {contact.lead_status ? "Leads" : "Contacts"}
      </Link>

      <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4">
        <UserAvatar name={contactName(contact)} email={contact.email ?? ""} src={null} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{contactName(contact)}</h1>
          <p className="text-sm text-muted-foreground">
            {contact.title}{contact.title && contact.company ? " at " : ""}
            {contact.company && <Link href={`/admin/clients/${contact.company.id}`} className="hover:underline">{contact.company.name}</Link>}
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            <RoleBadge role={contact.role} />
            {contact.lead_status && <Badge variant="outline">{LEAD_STATUSES.find((s) => s.id === contact.lead_status)?.label}</Badge>}
            {contact.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
            {echoUserId && <Badge className="gap-1"><UserRound className="size-3" /><Link href={`/admin/users/${echoUserId}`}>Echo customer</Link></Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!contact.phone} nativeButton={false} render={<a href={contact.phone ? `tel:${contact.phone}` : undefined} />}><Phone /> Call</Button>
          <Button variant="outline" size="sm" disabled={!contact.phone} nativeButton={false} render={<a href={contact.phone ? `sms:${contact.phone}` : undefined} />}><MessageSquare /> Text</Button>
          <Button variant="outline" size="sm" disabled={!contact.email} nativeButton={false} render={<a href={contact.email ? `mailto:${contact.email}` : undefined} />}><Mail /> Email</Button>
          {!readOnly && <Button size="sm" disabled={pending} onClick={() => start(async () => { const res = await addToPipeline([contact.id]); setMsg(res); if (res.id) router.push(`/admin/pipeline/${res.id}`); })}><GitBranchPlus /> Add to pipeline</Button>}
          {!readOnly && <Button variant="ghost" size="icon-sm" aria-label="Delete contact" disabled={pending}
            onClick={() => confirm(`Delete ${contactName(contact)}? Their activity is deleted too.`) && start(async () => { const res = await deleteContacts([contact.id]); if (res.error) setMsg(res); else router.push("/admin/contacts"); })}><Trash2 /></Button>}
        </div>
      </div>
      {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Details">
            {field("First name", "first_name")}{field("Last name", "last_name")}{field("Title", "title")}{field("Email", "email")}{field("Phone", "phone")}
            <DetailRow label="Company">{readOnly ? contact.company?.name : <Editable value={contact.company_id ?? ""} type="select"
              options={[{ value: "", label: "None" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} format={(v) => companies.find((c) => c.id === v)?.name} onSave={(v) => save({ company_id: v || null })} />}</DetailRow>
            <DetailRow label="Role">{readOnly ? <RoleBadge role={contact.role} /> : <Editable value={contact.role} type="select" options={opt(CONTACT_ROLES)} format={(v) => CONTACT_ROLES.find((r) => r.id === v)?.label} onSave={(v) => save({ role: v })} />}</DetailRow>
            <DetailRow label="Lead status">{readOnly ? LEAD_STATUSES.find((s) => s.id === contact.lead_status)?.label : <Editable value={contact.lead_status ?? ""} type="select"
              options={[{ value: "", label: "Not a lead" }, ...opt(LEAD_STATUSES)]} format={(v) => LEAD_STATUSES.find((s) => s.id === v)?.label} placeholder="Not a lead" onSave={(v) => save({ lead_status: v || null })} />}</DetailRow>
            <DetailRow label="Status">{readOnly ? contact.status : <Editable value={contact.status} type="select" options={opt(CONTACT_STATUSES)} format={(v) => CONTACT_STATUSES.find((s) => s.id === v)?.label} onSave={(v) => save({ status: v })} />}</DetailRow>
            <DetailRow label="Owner">{readOnly ? ownerName(staff, contact.owner_id) : <Editable value={contact.owner_id ?? ""} type="select"
              options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))]} format={(v) => ownerName(staff, v)} placeholder="Unassigned" onSave={(v) => save({ owner_id: v || null })} />}</DetailRow>
            {field("Source", "source")}{field("Interest", "interest")}{field("Website", "website")}{field("City", "city")}{field("State", "state")}
            <DetailRow label="Tags">{readOnly ? contact.tags.join(", ") : <Editable value={contact.tags.join(", ")} placeholder="Add tags" onSave={(v) => save({ tags: v })} />}</DetailRow>
          </Panel>
          {contact.notes && <Panel title="Notes"><p className="text-sm whitespace-pre-wrap">{contact.notes}</p></Panel>}
          {details.length > 0 && (
            <Panel title="Imported details">
              {Object.entries(grouped).map(([cat, rows]) => (
                <details key={cat} className="border-b py-1 last:border-0" open={cat === "Person"}>
                  <summary className="cursor-pointer py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{cat} ({rows.length})</summary>
                  {rows.map(([k, v]) => <DetailRow key={k} label={k}>{v}</DetailRow>)}
                </details>
              ))}
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title={`Deals (${deals.length})`}><DealRows deals={deals} /></Panel>
          <TimelinePanel activities={activities} staff={staff} target={{ contact_id: contact.id }} readOnly={readOnly} seenKey={contact.id} />
        </div>
      </div>
    </div>
  );
}
