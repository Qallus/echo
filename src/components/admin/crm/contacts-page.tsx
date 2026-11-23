"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Download, GitBranchPlus, Magnet, Mail, MapPin, Plus, Smartphone, Tag, Tags as TagsIcon, Trash2, Upload, UserCog, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView, type CollectionAction } from "@/components/collection/collection-view";
import { muted } from "@/components/collection/kit";
import { addToPipeline } from "@/lib/admin/actions/crm-pipeline";
import { bulkUpdate, type BulkChange } from "@/lib/admin/actions/crm-bulk";
import { geocodeContacts } from "@/lib/admin/actions/crm";
import { deleteContacts } from "@/lib/admin/actions/crm-people";
import { contactsToCsv, downloadCsv } from "@/lib/crm/csv";
import { CONTACT_ROLES, CONTACT_STATUSES, LEAD_STATUSES, contactName, contactPlace, ownerName, type Contact, type ContactRole, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { StatRow, StatTile } from "./crm-kit";
import { emailEveryone } from "./bulk-bar";
import { ComposeDialog, type Person } from "@/components/admin/comms/compose-dialog";
import { ContactPreview, contactAvatar, contactWhere } from "./contact-preview";
import { ImportDialog } from "./import-dialog";
import { PhoneImportDialog } from "./phone-import-dialog";
import { ContactDialog } from "./record-dialogs";

export function RoleBadge({ role }: { role: ContactRole }) {
  const r = CONTACT_ROLES.find((x) => x.id === role)!;
  return <Badge className={cn("border-transparent", r.tone)}>{r.label}</Badge>;
}

const business = (c: Contact) => c.company_name ?? c.company?.name ?? null;
type Msg = { ok?: string; error?: string };

// Everyone Qallus works with, Lead -> Prospect -> Client, on the shared list
// layout: board by role, list, table, cards, map and calendar (by the day
// they were added); bulk Add to Pipeline, tags, role, status and owner; CSV
// in and out, and contacts from a phone.
export function ContactsPage({ contacts, companies, staff, readOnly, phoneImport }: {
  contacts: Contact[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean; phoneImport?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [composeTo, setComposeTo] = useState<Person[] | null>(null);
  const [fromPhone, setFromPhone] = useState(Boolean(phoneImport && !readOnly));
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();

  const count = (r: ContactRole) => contacts.filter((c) => c.role === r && c.status === "active").length;
  const unplaced = contacts.filter((c) => c.latitude == null && !c.geocoded_address && contactPlace(c)).length;
  const done = async (p: Promise<Msg>) => { const r = await p; setMsg(r); if (!r.error) router.refresh(); return r; };
  const run = (fn: () => Promise<Msg>) => start(async () => { await done(fn()); });
  const ids = (rows: Contact[]) => rows.map((c) => c.id);
  const change = (rows: Contact[], patch: BulkChange) => done(bulkUpdate("crm_contacts", ids(rows), patch));
  const remove = (rows: Contact[]) => confirm(`Delete ${rows.length === 1 ? "this contact" : `${rows.length} contacts`}? Their activity is deleted too.`)
    && done(deleteContacts(ids(rows)));
  const people = [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))];

  const actions: CollectionAction<Contact>[] = [
    ...(readOnly ? [] : [
      { label: "Add to pipeline", icon: GitBranchPlus, run: (rows: Contact[]) => done(addToPipeline(ids(rows))) },
      { label: "Add tags", icon: Tag, input: { placeholder: "Tags, comma separated", submit: "Add tags", onSubmit: (rows: Contact[], v: string) => change(rows, { add_tags: v }) } },
      { label: "Remove tags", icon: TagsIcon, input: { placeholder: "Tags to remove", submit: "Remove tags", onSubmit: (rows: Contact[], v: string) => change(rows, { remove_tags: v }) } },
      { label: "Role", icon: UserCog, options: CONTACT_ROLES.map((r) => ({ value: r.id, label: r.label })), pick: (rows: Contact[], v: string) => change(rows, { role: v }) },
      { label: "Status", icon: Archive, options: CONTACT_STATUSES.map((r) => ({ value: r.id, label: r.label })), pick: (rows: Contact[], v: string) => change(rows, { status: v }) },
      { label: "Lead status", icon: Magnet, options: [{ value: "", label: "Not a lead" }, ...LEAD_STATUSES.map((r) => ({ value: r.id, label: r.label }))], pick: (rows: Contact[], v: string) => change(rows, { lead_status: v }) },
      { label: "Owner", icon: UserRound, options: people, pick: (rows: Contact[], v: string) => change(rows, { owner_id: v || null }) },
    ] satisfies CollectionAction<Contact>[]),
    { label: "Email", icon: Mail, run: (rows) => (readOnly
      ? emailEveryone(rows.map((c) => c.email))
      : setComposeTo(rows.map((c) => ({ id: c.id, name: contactName(c), email: c.email })))) },
    { label: "Export", icon: Download, run: (rows) => downloadCsv("contacts.csv", contactsToCsv(rows)) },
    ...(readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true, run: remove }]),
  ];

  return (
    <div className="space-y-6">
      <StatRow>
        <StatTile label="All contacts" value={contacts.length} />
        <StatTile label="Leads" value={count("lead")} />
        <StatTile label="Prospects" value={count("prospect")} />
        <StatTile label="Clients" value={count("client")} accent />
      </StatRow>

      {(msg.ok || msg.error) && (
        <p className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", msg.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40")}>
          <span className="flex-1">{msg.error ?? msg.ok}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMsg({})} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </p>
      )}

      <CollectionView<Contact>
        items={contacts} getId={(c) => c.id} title={contactName} noun={["contact", "contacts"]} storageKey="admin-contacts" defaultView="list"
        media={(c) => contactAvatar(c)}
        subtitle={(c) => [c.title, business(c), contactWhere(c)].filter(Boolean).join(" · ") || c.email || "—"}
        badge={(c) => <RoleBadge role={c.role} />}
        meta={(c) => [c.email, ownerName(staff, c.owner_id)].filter(Boolean).join(" · ") || "—"}
        searchText={(c) => `${contactName(c)} ${c.email ?? ""} ${c.phone ?? ""} ${business(c) ?? ""} ${c.title ?? ""} ${c.city ?? ""} ${c.state ?? ""} ${c.zip ?? ""} ${c.source ?? ""} ${c.tags.join(" ")} ${ownerName(staff, c.owner_id) ?? ""}`}
        filters={[
          { id: "active", label: "Active", test: (c) => c.status === "active" },
          ...CONTACT_ROLES.map((r) => ({ id: r.id, label: `${r.label}s`, test: (c: Contact) => c.role === r.id && c.status === "active" })),
          { id: "inactive", label: "Inactive", test: (c) => c.status === "inactive" },
          { id: "archived", label: "Archived", test: (c) => c.status === "archived" },
          { id: "all", label: "Everyone", test: () => true },
        ]}
        columns={[
          { id: "name", label: "Name", cell: (c) => <span className="flex items-center gap-2">{contactAvatar(c, "sm")}<span className="font-medium">{contactName(c)}</span></span>, sort: contactName },
          { id: "role", label: "Role", cell: (c) => <RoleBadge role={c.role} />, sort: (c) => c.role },
          { id: "business", label: "Business", cell: (c) => muted(business(c)), sort: business },
          { id: "email", label: "Email", cell: (c) => muted(c.email), sort: (c) => c.email },
          { id: "phone", label: "Phone", cell: (c) => muted(c.phone) },
          { id: "place", label: "City", cell: (c) => muted(contactWhere(c) || null), sort: (c) => contactWhere(c) || null },
          { id: "source", label: "Source", cell: (c) => muted(c.source), sort: (c) => c.source },
          { id: "owner", label: "Owner", cell: (c) => muted(ownerName(staff, c.owner_id)), sort: (c) => ownerName(staff, c.owner_id) },
          { id: "added", label: "Added", cell: (c) => new Date(c.created_at).toLocaleDateString(), sort: (c) => c.created_at },
        ]}
        board={{
          lanes: CONTACT_ROLES.map((r) => ({ id: r.id, label: <RoleBadge role={r.id} /> })),
          lane: (c) => c.role,
          onMove: readOnly ? undefined : (c, role) => run(() => bulkUpdate("crm_contacts", [c.id], { role })),
        }}
        location={(c) => (c.latitude != null && c.longitude != null ? { lat: c.latitude, lng: c.longitude } : null)}
        date={(c) => c.created_at}
        actions={actions}
        preview={(c, close) => (
          <ContactPreview c={c} staff={staff} badge={<RoleBadge role={c.role} />} pending={pending}
            onPipeline={readOnly ? undefined : () => run(() => addToPipeline([c.id]))}
            onEdit={readOnly ? undefined : () => { close(); setEditing(c); }} />
        )}
        toolbar={
          <>
            {!readOnly && unplaced > 0 && <Button variant="outline" disabled={pending} title="Find each address on the map (about a second each)" onClick={() => run(geocodeContacts)}><MapPin /> Place on map ({unplaced})</Button>}
            <Button variant="outline" onClick={() => downloadCsv("contacts.csv", contactsToCsv(contacts))} disabled={!contacts.length}><Download /> Export</Button>
            {!readOnly && <Button variant="outline" onClick={() => setFromPhone(true)}><Smartphone /> From phone</Button>}
            {!readOnly && <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>}
            {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> Add contact</Button>}
          </>
        }
        empty="No contacts yet. Add one or import a CSV."
      />

      {editing && <ContactDialog open onOpenChange={(o) => !o && setEditing(null)} contact={editing === "new" ? undefined : editing} companies={companies} staff={staff} stay={editing !== "new"} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} role="contact" />}
      {composeTo && <ComposeDialog initial={composeTo} people={contacts.map((c) => ({ id: c.id, name: contactName(c), email: c.email }))} onClose={() => setComposeTo(null)} />}
      {fromPhone && <PhoneImportDialog existing={contacts} onClose={() => { setFromPhone(false); if (phoneImport) router.replace("/admin/contacts"); }} />}
    </div>
  );
}
