"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Archive, Download, ExternalLink, Magnet, Tag, Tags as TagsIcon, UserCog, UserRound, Eye, GitBranchPlus, Kanban, LayoutGrid, List, Mail, MessageSquare, Pencil, Phone, Plus, Smartphone, Table as TableIcon, Trash2, Upload } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addToPipeline } from "@/lib/admin/actions/crm-pipeline";
import { bulkUpdate, type BulkChange } from "@/lib/admin/actions/crm-bulk";
import { deleteContacts } from "@/lib/admin/actions/crm-people";
import { contactsToCsv, downloadCsv } from "@/lib/crm/csv";
import { CONTACT_ROLES, CONTACT_STATUSES, LEAD_STATUSES, contactName, ownerName, type Contact, type ContactRole, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { DetailRow, EmptyState, RowActions, SearchBox, StatRow, StatTile, ViewSwitcher, type RowAction } from "./crm-kit";
import { FILTER } from "./crm-ui";
import { BulkBar, emailEveryone, type BulkAction } from "./bulk-bar";
import { DataTable, plain, type Column } from "./data-table";
import { ImportDialog } from "./import-dialog";
import { PhoneImportDialog } from "./phone-import-dialog";
import { ContactDialog } from "./record-dialogs";

type View = "list" | "table" | "cards" | "board";
const VIEWS = [
  { id: "list" as const, label: "List", icon: List },
  { id: "table" as const, label: "Table", icon: TableIcon },
  { id: "cards" as const, label: "Cards", icon: LayoutGrid },
  { id: "board" as const, label: "Board", icon: Kanban },
];

export function RoleBadge({ role }: { role: ContactRole }) {
  const r = CONTACT_ROLES.find((x) => x.id === role)!;
  return <Badge className={cn("border-transparent", r.tone)}>{r.label}</Badge>;
}

// Everyone Qallus works with, Lead -> Prospect -> Client (Channel-Cast's
// contacts page): filters, views, bulk Add to Pipeline, CSV in and out.
export function ContactsPage({ contacts, companies, staff, readOnly, phoneImport }: {
  contacts: Contact[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean; phoneImport?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("active");
  const [tag, setTag] = useState("");
  const [owner, setOwner] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<string | null>(null);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [fromPhone, setFromPhone] = useState(Boolean(phoneImport && !readOnly));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const tags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => (!role || c.role === role) && (!status || c.status === status) && (!tag || c.tags.includes(tag)) && (!owner || c.owner_id === owner)
      && (!q || `${contactName(c)} ${c.email ?? ""} ${c.phone ?? ""} ${c.company?.name ?? ""} ${c.title ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q)));
  }, [contacts, search, role, status, tag, owner]);
  const count = (r: ContactRole) => contacts.filter((c) => c.role === r).length;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shown.map((c) => c.id)));
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => { const res = await fn(); setMsg(res); if (!res.error) after?.(); });
  const pipeline = (ids: string[]) => run(() => addToPipeline(ids), () => setSelected(new Set()));
  const remove = (ids: string[]) => confirm(`Delete ${ids.length === 1 ? "this contact" : `${ids.length} contacts`}? Their activity is deleted too.`)
    && run(() => deleteContacts(ids), () => { setSelected(new Set()); setDrawer(null); });

  const actions = (c: Contact): RowAction[] => [
    { label: "Open record", icon: ExternalLink, onClick: () => router.push(`/admin/contacts/${c.id}`) },
    { label: "Quick view", icon: Eye, onClick: () => setDrawer(c.id) },
    ...(readOnly ? [] : [
      { label: "Add to pipeline", icon: GitBranchPlus, onClick: () => pipeline([c.id]) },
      { label: "Edit", icon: Pencil, onClick: () => setEditing(c) },
      { label: "Delete", icon: Trash2, onClick: () => remove([c.id]), destructive: true },
    ]),
  ];
  const d = contacts.find((c) => c.id === drawer) ?? null;
  const ids = [...selected];
  const change = (patch: BulkChange) => run(() => bulkUpdate("crm_contacts", ids, patch));
  const people = [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))];
  const bulk: BulkAction[] = [
    ...(readOnly ? [] : [
      { label: "Add to pipeline", icon: GitBranchPlus, run: () => pipeline(ids) },
      { label: "Add tags", icon: Tag, input: { placeholder: "Tags, comma separated", submit: "Add tags", onSubmit: (v: string) => change({ add_tags: v }) } },
      { label: "Remove tags", icon: TagsIcon, input: { placeholder: "Tags to remove", submit: "Remove tags", onSubmit: (v: string) => change({ remove_tags: v }) } },
      { label: "Role", icon: UserCog, options: CONTACT_ROLES.map((r) => ({ value: r.id, label: r.label })), onPick: (v: string) => change({ role: v }) },
      { label: "Status", icon: Archive, options: CONTACT_STATUSES.map((r) => ({ value: r.id, label: r.label })), onPick: (v: string) => change({ status: v }) },
      { label: "Lead status", icon: Magnet, options: [{ value: "", label: "Not a lead" }, ...LEAD_STATUSES.map((r) => ({ value: r.id, label: r.label }))], onPick: (v: string) => change({ lead_status: v }) },
      { label: "Owner", icon: UserRound, options: people, onPick: (v: string) => change({ owner_id: v || null }) },
    ]),
    { label: "Email", icon: Mail, run: () => { const missing = emailEveryone(contacts.filter((c) => selected.has(c.id)).map((c) => c.email)); if (missing) setMsg({ ok: `${missing} selected have no email address.` }); } },
    { label: "Export", icon: Download, run: () => downloadCsv("contacts.csv", contactsToCsv(contacts.filter((c) => selected.has(c.id)))) },
    ...(readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true, run: () => remove(ids) }]),
  ];
  const columns: Column<Contact>[] = [
    { id: "name", label: "Name", cell: (c) => <span className="font-medium">{contactName(c)}</span>, value: contactName },
    { id: "role", label: "Role", cell: (c) => <RoleBadge role={c.role} />, value: (c) => CONTACT_ROLES.find((r) => r.id === c.role)!.label, filter: true },
    { id: "company", label: "Company", cell: (c) => plain(c.company?.name), value: (c) => c.company?.name ?? null, filter: true },
    { id: "email", label: "Email", cell: (c) => plain(c.email), value: (c) => c.email },
    { id: "phone", label: "Phone", cell: (c) => plain(c.phone), value: (c) => c.phone },
    { id: "title", label: "Title", cell: (c) => plain(c.title), value: (c) => c.title, hidden: true },
    { id: "lead", label: "Lead status", cell: (c) => plain(LEAD_STATUSES.find((s) => s.id === c.lead_status)?.label), value: (c) => LEAD_STATUSES.find((s) => s.id === c.lead_status)?.label ?? null, filter: true, hidden: true },
    { id: "status", label: "Status", cell: (c) => plain(CONTACT_STATUSES.find((s) => s.id === c.status)?.label), value: (c) => CONTACT_STATUSES.find((s) => s.id === c.status)!.label, filter: true, hidden: true },
    { id: "tags", label: "Tags", cell: (c) => c.tags.join(", ") || "—", value: (c) => c.tags, filter: true, hidden: true },
    { id: "city", label: "City", cell: (c) => plain(c.city), value: (c) => c.city, filter: true, hidden: true },
    { id: "state", label: "State", cell: (c) => plain(c.state), value: (c) => c.state, filter: true, hidden: true },
    { id: "source", label: "Source", cell: (c) => plain(c.source), value: (c) => c.source, filter: true, hidden: true },
    { id: "owner", label: "Owner", cell: (c) => plain(ownerName(staff, c.owner_id)), value: (c) => ownerName(staff, c.owner_id), filter: true },
    { id: "created", label: "Added", cell: (c) => new Date(c.created_at).toLocaleDateString(), value: (c) => c.created_at, hidden: true },
  ];

  return (
    <div className="space-y-6">
      <StatRow>
        <StatTile label="All contacts" value={contacts.length} />
        <StatTile label="Leads" value={count("lead")} />
        <StatTile label="Prospects" value={count("prospect")} />
        <StatTile label="Clients" value={count("client")} accent />
      </StatRow>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search contacts…" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={FILTER} aria-label="Role">
            <option value="">All roles</option>{CONTACT_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={FILTER} aria-label="Status">
            <option value="">Any status</option>{CONTACT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {tags.length > 0 && (
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={FILTER} aria-label="Tag">
              <option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={FILTER} aria-label="Owner">
            <option value="">All owners</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
          <Button variant="outline" onClick={() => downloadCsv("contacts.csv", contactsToCsv(shown))}><Download /> Export</Button>
          {!readOnly && <Button variant="outline" onClick={() => setFromPhone(true)}><Smartphone /> From phone</Button>}
          {!readOnly && <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button>}
          {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> Add contact</Button>}
        </div>
      </div>

      <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())}
        onSelectAll={() => setSelected(new Set(shown.map((c) => c.id)))} actions={bulk} />
      {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}

      {shown.length === 0 ? (
        <EmptyState message={contacts.length ? "No contacts match your filters." : "No contacts yet. Add one or import a CSV."} />
      ) : view === "list" ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all {shown.length}</label>
          {shown.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${contactName(c)}`} />
              <button type="button" onClick={() => setDrawer(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <UserAvatar name={contactName(c)} email={c.email ?? ""} src={null} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{contactName(c)}</span><RoleBadge role={c.role} /></span>
                  <span className="block truncate text-xs text-muted-foreground">{[c.title, c.company?.name, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || c.email || "—"}</span>
                </span>
              </button>
              <span className="hidden truncate text-xs text-muted-foreground md:block md:w-48">{c.email}</span>
              <RowActions actions={actions(c)} />
            </div>
          ))}
        </div>
      ) : view === "table" ? (
        <DataTable rows={shown} columns={columns} getId={(c) => c.id} selected={selected} onSelect={setSelected}
          onOpen={(c) => setDrawer(c.id)} rowEnd={(c) => <RowActions actions={actions(c)} />} />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <div key={c.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${contactName(c)}`} />
                <button type="button" onClick={() => setDrawer(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <UserAvatar name={contactName(c)} email={c.email ?? ""} src={null} size="md" />
                  <span className="min-w-0"><span className="block truncate font-medium">{contactName(c)}</span><span className="block truncate text-xs text-muted-foreground">{[c.title, c.company?.name].filter(Boolean).join(" · ") || "—"}</span></span>
                </button>
                <RowActions actions={actions(c)} />
              </div>
              <div className="flex flex-wrap gap-1"><RoleBadge role={c.role} />{c.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {CONTACT_ROLES.map((r) => {
            const col = shown.filter((c) => c.role === r.id);
            return (
              <section key={r.id} className="w-64 shrink-0 rounded-xl border bg-card p-2">
                <div className="mb-2 flex items-center justify-between px-1"><RoleBadge role={r.id} /><span className="text-xs text-muted-foreground">{col.length}</span></div>
                <div className="space-y-2">
                  {col.map((c) => (
                    <button key={c.id} type="button" onClick={() => setDrawer(c.id)} className="w-full rounded-md border bg-background p-2.5 text-left hover:border-primary/40">
                      <p className="truncate text-sm font-medium">{contactName(c)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.company?.name ?? c.email ?? "—"}</p>
                    </button>
                  ))}
                  {col.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground/60">Empty</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Sheet open={Boolean(d)} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="overflow-y-auto p-5 sm:max-w-md">
          {d && (
            <div className="space-y-5">
              <SheetHeader className="p-0">
                <div className="flex items-center gap-3">
                  <UserAvatar name={contactName(d)} email={d.email ?? ""} src={null} size="lg" />
                  <div className="min-w-0"><SheetTitle className="truncate">{contactName(d)}</SheetTitle><p className="truncate text-sm text-muted-foreground">{[d.title, d.company?.name].filter(Boolean).join(" · ")}</p></div>
                </div>
              </SheetHeader>
              <div className="flex flex-wrap gap-1">
                <RoleBadge role={d.role} />
                {d.lead_status && <Badge variant="outline">{LEAD_STATUSES.find((s) => s.id === d.lead_status)?.label}</Badge>}
                {d.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" disabled={!d.phone} nativeButton={false} render={<a href={d.phone ? `tel:${d.phone}` : undefined} />}><Phone /> Call</Button>
                <Button variant="outline" size="sm" disabled={!d.phone} nativeButton={false} render={<a href={d.phone ? `sms:${d.phone}` : undefined} />}><MessageSquare /> Text</Button>
                <Button variant="outline" size="sm" disabled={!d.email} nativeButton={false} render={<a href={d.email ? `mailto:${d.email}` : undefined} />}><Mail /> Email</Button>
              </div>
              <div>
                <DetailRow label="Email">{d.email}</DetailRow>
                <DetailRow label="Phone">{d.phone}</DetailRow>
                <DetailRow label="Company">{d.company?.name}</DetailRow>
                <DetailRow label="Location">{[d.city, d.state].filter(Boolean).join(", ") || null}</DetailRow>
                <DetailRow label="Source">{d.source}</DetailRow>
                <DetailRow label="Owner">{ownerName(staff, d.owner_id)}</DetailRow>
              </div>
              {d.notes && <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{d.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="flex-1" nativeButton={false} render={<Link href={`/admin/contacts/${d.id}`} />}><ExternalLink /> Open record</Button>
                {!readOnly && <Button variant="outline" disabled={pending} onClick={() => pipeline([d.id])}><GitBranchPlus /> Pipeline</Button>}
                {!readOnly && <Button variant="outline" onClick={() => setEditing(d)}><Pencil /> Edit</Button>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editing && <ContactDialog open onOpenChange={(o) => !o && setEditing(null)} contact={editing === "new" ? undefined : editing} companies={companies} staff={staff} stay={editing !== "new"} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} role="contact" />}
      {fromPhone && <PhoneImportDialog existing={contacts} onClose={() => { setFromPhone(false); if (phoneImport) router.replace("/admin/contacts"); }} />}
    </div>
  );
}
