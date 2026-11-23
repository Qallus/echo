"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, GitBranchPlus, Kanban, Mail, MapPin, Plus, Tag, Trash2, Upload, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView, type CollectionAction } from "@/components/collection/collection-view";
import { muted } from "@/components/collection/kit";
import { addToPipeline } from "@/lib/admin/actions/crm-pipeline";
import { bulkDelete, bulkUpdate, type BulkChange } from "@/lib/admin/actions/crm-bulk";
import { geocodeContacts } from "@/lib/admin/actions/crm";
import { setLeadStatus } from "@/lib/admin/actions/crm-people";
import { contactsToCsv, downloadCsv } from "@/lib/crm/csv";
import { LEAD_STATUSES, contactName, contactPlace, ownerName, type Contact, type LeadStatus, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { StatRow, StatTile } from "./crm-kit";
import { emailEveryone } from "./bulk-bar";
import { ComposeDialog, type Person } from "@/components/admin/comms/compose-dialog";
import { ContactPreview, contactAvatar, contactWhere } from "./contact-preview";
import { ImportDialog } from "./import-dialog";
import { ContactDialog } from "./record-dialogs";

export function LeadStatusBadge({ status }: { status: LeadStatus | null }) {
  const s = LEAD_STATUSES.find((x) => x.id === (status ?? "new"))!;
  return <Badge className={cn("border-transparent", s.tone)}>{s.label}</Badge>;
}

const statusOf = (c: Contact): LeadStatus => c.lead_status ?? "new";
const isOpen = (c: Contact) => LEAD_STATUSES.find((s) => s.id === statusOf(c))?.open ?? true;
const sub = (c: Contact) => [c.company_name ?? c.company?.name, c.interest, c.source].filter(Boolean).join(" · ");
type Msg = { ok?: string; error?: string };

// Inquiries before they're opportunities, on the shared list layout: drag
// them across the board through the lead lifecycle, then Add to Pipeline.
// Also list, table, cards, map, and a calendar by the day they came in.
export function LeadsPage({ leads, companies, staff, readOnly }: {
  leads: Contact[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(leads);
  const [prev, setPrev] = useState(leads);
  if (leads !== prev) { setPrev(leads); setList(leads); }
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [composeTo, setComposeTo] = useState<Person[] | null>(null);
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();

  const n = (...ids: LeadStatus[]) => list.filter((c) => ids.includes(statusOf(c))).length;
  const unplaced = list.filter((c) => c.latitude == null && !c.geocoded_address && contactPlace(c)).length;
  const done = async (p: Promise<Msg>) => { const r = await p; setMsg(r); if (!r.error) router.refresh(); return r; };
  const run = (fn: () => Promise<Msg>) => start(async () => { await done(fn()); });
  const ids = (rows: Contact[]) => rows.map((c) => c.id);
  const change = (rows: Contact[], patch: BulkChange) => done(bulkUpdate("crm_contacts", ids(rows), patch));
  // Drag on the board: move the card at once, put it back if saving fails.
  const move = (c: Contact, status: LeadStatus) => {
    if (readOnly || statusOf(c) === status) return;
    const before = list;
    setList(list.map((x) => (x.id === c.id ? { ...x, lead_status: status } : x)));
    start(async () => { const r = await setLeadStatus([c.id], status); setMsg(r); if (r.error) setList(before); });
  };

  const actions: CollectionAction<Contact>[] = [
    ...(readOnly ? [] : [
      { label: "Add to pipeline", icon: GitBranchPlus, run: (rows: Contact[]) => done(addToPipeline(ids(rows))) },
      { label: "Lead status", icon: Kanban, options: LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label })), pick: (rows: Contact[], v: string) => change(rows, { lead_status: v }) },
      { label: "Owner", icon: UserRound, options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))], pick: (rows: Contact[], v: string) => change(rows, { owner_id: v || null }) },
      { label: "Add tags", icon: Tag, input: { placeholder: "Tags, comma separated", submit: "Add tags", onSubmit: (rows: Contact[], v: string) => change(rows, { add_tags: v }) } },
    ] satisfies CollectionAction<Contact>[]),
    { label: "Email", icon: Mail, run: (rows) => (readOnly ? emailEveryone(rows.map((c) => c.email)) : setComposeTo(rows.map((c) => ({ id: c.id, name: contactName(c), email: c.email })))) },
    { label: "Export", icon: Download, run: (rows) => downloadCsv("leads.csv", contactsToCsv(rows)) },
    ...(readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true,
      run: (rows: Contact[]) => confirm(`Delete ${rows.length === 1 ? contactName(rows[0]) : `${rows.length} leads`}? Their activity is deleted too.`) && done(bulkDelete("crm_contacts", ids(rows))) }]),
  ];

  return (
    <div className="space-y-6">
      <StatRow>
        <StatTile label="New" value={n("new")} />
        <StatTile label="Working" value={n("attempting", "contacted")} />
        <StatTile label="Qualified" value={n("qualified")} accent />
        <StatTile label="In pipeline" value={n("in_pipeline")} />
      </StatRow>

      {(msg.ok || msg.error) && (
        <p className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", msg.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40")}>
          <span className="flex-1">{msg.error ?? msg.ok}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMsg({})} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </p>
      )}

      <CollectionView<Contact>
        items={list} getId={(c) => c.id} title={contactName} noun={["lead", "leads"]} storageKey="admin-leads" defaultView="board"
        media={(c) => contactAvatar(c, "sm")}
        subtitle={(c) => sub(c) || c.email || "—"}
        badge={(c) => <LeadStatusBadge status={c.lead_status} />}
        meta={(c) => ownerName(staff, c.owner_id) ?? "Unassigned"}
        searchText={(c) => `${contactName(c)} ${c.email ?? ""} ${c.phone ?? ""} ${sub(c)} ${c.city ?? ""} ${c.state ?? ""} ${c.zip ?? ""} ${c.tags.join(" ")} ${ownerName(staff, c.owner_id) ?? ""}`}
        filters={[
          { id: "open", label: "Open", test: isOpen },
          ...LEAD_STATUSES.map((s) => ({ id: s.id, label: s.label, test: (c: Contact) => statusOf(c) === s.id })),
          { id: "all", label: "All", test: () => true },
        ]}
        columns={[
          { id: "name", label: "Lead", cell: (c) => <span className="flex items-center gap-2">{contactAvatar(c, "sm")}<span className="font-medium">{contactName(c)}</span></span>, sort: contactName },
          { id: "status", label: "Status", cell: (c) => <LeadStatusBadge status={c.lead_status} />, sort: (c) => LEAD_STATUSES.findIndex((s) => s.id === statusOf(c)) },
          { id: "business", label: "Business", cell: (c) => muted(c.company_name ?? c.company?.name), sort: (c) => c.company_name ?? c.company?.name ?? null },
          { id: "interest", label: "Interest", cell: (c) => muted(c.interest), sort: (c) => c.interest },
          { id: "source", label: "Source", cell: (c) => muted(c.source), sort: (c) => c.source },
          { id: "place", label: "City", cell: (c) => muted(contactWhere(c) || null), sort: (c) => contactWhere(c) || null },
          { id: "owner", label: "Owner", cell: (c) => muted(ownerName(staff, c.owner_id)), sort: (c) => ownerName(staff, c.owner_id) },
          { id: "created", label: "Came in", cell: (c) => new Date(c.created_at).toLocaleDateString(), sort: (c) => c.created_at },
        ]}
        board={{
          lanes: LEAD_STATUSES.map((s) => ({ id: s.id, label: <LeadStatusBadge status={s.id} /> })),
          lane: statusOf,
          onMove: readOnly ? undefined : (c, lane) => move(c, lane as LeadStatus),
        }}
        location={(c) => (c.latitude != null && c.longitude != null ? { lat: c.latitude, lng: c.longitude } : null)}
        date={(c) => c.created_at}
        actions={actions}
        preview={(c, close) => (
          <ContactPreview c={c} staff={staff} badge={<LeadStatusBadge status={c.lead_status} />} openLabel="Work lead" pending={pending}
            onPipeline={readOnly ? undefined : () => run(() => addToPipeline([c.id]))}
            onEdit={readOnly ? undefined : () => { close(); setEditing(c); }} />
        )}
        toolbar={
          <>
            {!readOnly && unplaced > 0 && <Button variant="outline" disabled={pending} title="Find each address on the map (about a second each)" onClick={() => run(geocodeContacts)}><MapPin /> Place on map ({unplaced})</Button>}
            <Button variant="outline" onClick={() => downloadCsv("leads.csv", contactsToCsv(list))} disabled={!list.length}><Download /> Export</Button>
            {!readOnly && <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import</Button>}
            {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> Add lead</Button>}
          </>
        }
        empty="No leads yet. Add one or import a CSV."
      />

      {editing && <ContactDialog open onOpenChange={(o) => !o && setEditing(null)} contact={editing === "new" ? undefined : editing} role="lead" companies={companies} staff={staff} stay={editing !== "new"} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} role="lead" />}
      {composeTo && <ComposeDialog initial={composeTo} people={list.map((c) => ({ id: c.id, name: contactName(c), email: c.email }))} onClose={() => setComposeTo(null)} />}
    </div>
  );
}
