"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ban, CalendarDays, Download, Mail, Tag, UserRound, ExternalLink, GitBranchPlus, Kanban, LayoutGrid, List, Pencil, Plus, Table as TableIcon, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { addToPipeline } from "@/lib/admin/actions/crm-pipeline";
import { bulkDelete, bulkUpdate, type BulkChange } from "@/lib/admin/actions/crm-bulk";
import { deleteContacts, setLeadStatus } from "@/lib/admin/actions/crm-people";
import { contactsToCsv, downloadCsv } from "@/lib/crm/csv";
import { LEAD_STATUSES, contactName, ownerName, type Contact, type LeadStatus, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { EmptyState, RecordCalendar, RowActions, SearchBox, StatRow, StatTile, ViewSwitcher, type RowAction } from "./crm-kit";
import { BulkBar, emailEveryone, type BulkAction } from "./bulk-bar";
import { DataTable, plain, type Column } from "./data-table";
import { ComposeDialog, type Person } from "@/components/admin/comms/compose-dialog";
import { ImportDialog } from "./import-dialog";
import { ContactDialog } from "./record-dialogs";

type View = "board" | "list" | "table" | "cards" | "calendar";
const VIEWS = [
  { id: "board" as const, label: "Board", icon: Kanban },
  { id: "list" as const, label: "List", icon: List },
  { id: "table" as const, label: "Table", icon: TableIcon },
  { id: "cards" as const, label: "Cards", icon: LayoutGrid },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
];

export function LeadStatusBadge({ status }: { status: LeadStatus | null }) {
  const s = LEAD_STATUSES.find((x) => x.id === (status ?? "new"))!;
  return <Badge className={cn("border-transparent", s.tone)}>{s.label}</Badge>;
}

const sub = (c: Contact) => [c.company?.name, c.interest, c.source].filter(Boolean).join(" · ");

// Inquiries before they're opportunities: work them through the lead
// lifecycle, then Add to Pipeline (Channel-Cast's leads page).
export function LeadsPage({ leads, companies, staff, readOnly }: {
  leads: Contact[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(leads);
  const [prev, setPrev] = useState(leads);
  if (leads !== prev) { setPrev(leads); setList(leads); }
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [composeTo, setComposeTo] = useState<Person[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [, start] = useTransition();

  const statuses = LEAD_STATUSES.filter((s) => showClosed || s.open);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((c) => (!owner || c.owner_id === owner) && (showClosed || LEAD_STATUSES.find((s) => s.id === (c.lead_status ?? "new"))?.open)
      && (!q || `${contactName(c)} ${c.email ?? ""} ${sub(c)}`.toLowerCase().includes(q)));
  }, [list, search, owner, showClosed]);
  const n = (...ids: LeadStatus[]) => list.filter((c) => ids.includes(c.lead_status ?? "new")).length;

  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));
  const setStatus = (c: Contact, status: LeadStatus) => {
    if (readOnly || c.lead_status === status) return;
    const before = list;
    setList(list.map((x) => (x.id === c.id ? { ...x, lead_status: status } : x)));
    start(async () => { const res = await setLeadStatus([c.id], status); setMsg(res); if (res.error) setList(before); });
  };
  const open = (id: string) => router.push(`/admin/contacts/${id}`);
  const actions = (c: Contact): RowAction[] => [
    { label: "Work lead", icon: ExternalLink, onClick: () => open(c.id) },
    ...(readOnly ? [] : [
      { label: "Add to pipeline", icon: GitBranchPlus, onClick: () => run(() => addToPipeline([c.id])) },
      { label: "Disqualify", icon: Ban, onClick: () => setStatus(c, "disqualified") },
      { label: "Edit", icon: Pencil, onClick: () => setEditing(c) },
      { label: "Delete", icon: Trash2, onClick: () => confirm(`Delete ${contactName(c)}?`) && run(() => deleteContacts([c.id])), destructive: true },
    ]),
  ];

  const ids = [...selected];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const box = (c: Contact) => <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${contactName(c)}`} />;
  const change = (patch: BulkChange) => run(() => bulkUpdate("crm_contacts", ids, patch));
  const picked = () => list.filter((c) => selected.has(c.id));
  const bulk: BulkAction[] = [
    ...(readOnly ? [] : [
      { label: "Add to pipeline", icon: GitBranchPlus, run: () => run(async () => { const r = await addToPipeline(ids); if (!r.error) setSelected(new Set()); return r; }) },
      { label: "Lead status", icon: Kanban, options: LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label })), onPick: (v: string) => change({ lead_status: v }) },
      { label: "Owner", icon: UserRound, options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))], onPick: (v: string) => change({ owner_id: v || null }) },
      { label: "Add tags", icon: Tag, input: { placeholder: "Tags, comma separated", submit: "Add tags", onSubmit: (v: string) => change({ add_tags: v }) } },
    ]),
    { label: "Email", icon: Mail, run: () => (readOnly ? emailEveryone(picked().map((c) => c.email)) : setComposeTo(picked().map((c) => ({ id: c.id, name: contactName(c), email: c.email })))) },
    { label: "Export", icon: Download, run: () => downloadCsv("leads.csv", contactsToCsv(picked())) },
    ...(readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true,
      run: () => confirm(`Delete ${ids.length} leads? Their activity is deleted too.`) && run(async () => { const r = await bulkDelete("crm_contacts", ids); if (!r.error) setSelected(new Set()); return r; }) }]),
  ];
  const columns: Column<Contact>[] = [
    { id: "name", label: "Lead", cell: (c) => <span className="font-medium">{contactName(c)}</span>, value: contactName },
    { id: "status", label: "Status", cell: (c) => <LeadStatusBadge status={c.lead_status} />, value: (c) => LEAD_STATUSES.find((s) => s.id === (c.lead_status ?? "new"))!.label, filter: true },
    { id: "company", label: "Company", cell: (c) => plain(c.company?.name), value: (c) => c.company?.name ?? null, filter: true },
    { id: "interest", label: "Interest", cell: (c) => plain(c.interest), value: (c) => c.interest, filter: true },
    { id: "source", label: "Source", cell: (c) => plain(c.source), value: (c) => c.source, filter: true },
    { id: "email", label: "Email", cell: (c) => plain(c.email), value: (c) => c.email, hidden: true },
    { id: "phone", label: "Phone", cell: (c) => plain(c.phone), value: (c) => c.phone, hidden: true },
    { id: "tags", label: "Tags", cell: (c) => c.tags.join(", ") || "—", value: (c) => c.tags, filter: true, hidden: true },
    { id: "city", label: "City", cell: (c) => plain(c.city), value: (c) => c.city, filter: true, hidden: true },
    { id: "owner", label: "Owner", cell: (c) => plain(ownerName(staff, c.owner_id)), value: (c) => ownerName(staff, c.owner_id), filter: true },
    { id: "created", label: "Came in", cell: (c) => new Date(c.created_at).toLocaleDateString(), value: (c) => c.created_at },
  ];

  return (
    <div className="space-y-6">
      <StatRow>
        <StatTile label="New" value={n("new")} />
        <StatTile label="Working" value={n("attempting", "contacted")} />
        <StatTile label="Qualified" value={n("qualified")} accent />
        <StatTile label="In pipeline" value={n("in_pipeline")} />
      </StatRow>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search leads…" />
          <Pick label="Owner" className="w-fit" value={owner} onChange={(v) => setOwner(v)}
            options={[{ value: "", label: "All owners" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))]} />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> In pipeline & disqualified</label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
          {!readOnly && <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import</Button>}
          {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> Add lead</Button>}
        </div>
      </div>
      <BulkBar count={selected.size} total={shown.length} pending={false} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((c) => c.id)))} actions={bulk} />
      {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}

      {shown.length === 0 && view !== "board" ? (
        <EmptyState message={list.length ? "No leads match your filters." : "No leads yet. Add one or import a CSV."} />
      ) : view === "board" ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {statuses.map((s) => {
            const col = shown.filter((c) => (c.lead_status ?? "new") === s.id);
            return (
              <section key={s.id} className="flex w-64 shrink-0 flex-col rounded-xl border bg-card p-2"
                onDragOver={(e) => { if (dragging && !readOnly) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); const c = list.find((x) => x.id === dragging); if (c) setStatus(c, s.id); setDragging(null); }}>
                <div className="mb-2 flex items-center justify-between px-1"><LeadStatusBadge status={s.id} /><span className="text-xs text-muted-foreground">{col.length}</span></div>
                <div className="flex min-h-20 flex-1 flex-col gap-2">
                  {col.map((c) => (
                    <article key={c.id} draggable={!readOnly} onDragStart={() => setDragging(c.id)} onDragEnd={() => setDragging(null)}
                      className={cn("rounded-md border bg-background p-2.5", !readOnly && "cursor-grab", dragging === c.id && "opacity-50")}>
                      <div className="flex items-start gap-2">
                        <span className="pt-0.5">{box(c)}</span>
                        <button type="button" onClick={() => open(c.id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium">{contactName(c)}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{sub(c) || c.email || "—"}</p>
                        </button>
                        <RowActions actions={actions(c)} />
                      </div>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">{ownerName(staff, c.owner_id) ?? "Unassigned"}</p>
                    </article>
                  ))}
                  {col.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground/60">Empty</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {shown.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40">
              {box(c)}
              <button type="button" onClick={() => open(c.id)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{contactName(c)}</span><LeadStatusBadge status={c.lead_status} /></span>
                <span className="block truncate text-xs text-muted-foreground">{sub(c) || c.email || "—"}</span>
              </button>
              <span className="hidden text-xs text-muted-foreground sm:block">{ownerName(staff, c.owner_id) ?? "Unassigned"}</span>
              <RowActions actions={actions(c)} />
            </div>
          ))}
        </div>
      ) : view === "table" ? (
        <DataTable rows={shown} columns={columns} getId={(c) => c.id} selected={selected} onSelect={setSelected} onOpen={(c) => open(c.id)} rowEnd={(c) => <RowActions actions={actions(c)} />} />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <div key={c.id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-2">
                <span className="pt-1">{box(c)}</span>
                <button type="button" onClick={() => open(c.id)} className="min-w-0 flex-1 text-left"><p className="truncate font-medium">{contactName(c)}</p><p className="truncate text-xs text-muted-foreground">{sub(c) || c.email || "—"}</p></button>
                <RowActions actions={actions(c)} />
              </div>
              <LeadStatusBadge status={c.lead_status} />
            </div>
          ))}
        </div>
      ) : (
        <RecordCalendar items={shown} getId={(c) => c.id} getDate={(c) => c.created_at} getTitle={contactName} onOpen={open} footer="Leads placed by the day they came in." />
      )}

      {editing && <ContactDialog open onOpenChange={(o) => !o && setEditing(null)} contact={editing === "new" ? undefined : editing} role="lead" companies={companies} staff={staff} stay={editing !== "new"} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} role="lead" />}
      {composeTo && <ComposeDialog initial={composeTo} people={list.map((c) => ({ id: c.id, name: contactName(c), email: c.email }))} onClose={() => setComposeTo(null)} />}
    </div>
  );
}
