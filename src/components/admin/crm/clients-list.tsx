"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Building2, Download, Flag, LayoutGrid, Mail, Map as MapIcon, MapPin, Table as TableIcon, Tag, Tags as TagsIcon, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { geocodeClients } from "@/lib/admin/actions/crm";
import { bulkDelete, bulkUpdate, type BulkChange } from "@/lib/admin/actions/crm-bulk";
import { money } from "@/lib/billing/catalog";
import { downloadCsv } from "@/lib/crm/csv";
import { COMPANY_STATUSES, ownerName, type Company, type CompanyStatus, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { BulkBar, emailEveryone, type BulkAction } from "./bulk-bar";
import { EmptyState, SearchBox, ViewSwitcher } from "./crm-kit";
import { DataTable, plain, type Column } from "./data-table";
import { AddCompanyButton } from "./record-actions";

export type ClientRow = Company & { contacts: number; open_deals: number; open_value: number; won_value: number };

const statusLabel = (s: CompanyStatus) => COMPANY_STATUSES.find((x) => x.id === s)?.label ?? s;
const VIEWS = [{ id: "table" as const, label: "Table", icon: TableIcon }, { id: "cards" as const, label: "Cards", icon: LayoutGrid }, { id: "map" as const, label: "Map", icon: MapIcon }];
const ClientsMap = dynamic(() => import("./clients-map").then((m) => m.ClientsMap), { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl border bg-muted/40" /> });

// Clients with contact and pipeline totals; select rows for bulk changes.
export function ClientsList({ clients, staff, readOnly }: { clients: ClientRow[]; staff: StaffOption[]; readOnly: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "cards" | "map">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => !q || `${c.name} ${c.industry ?? ""} ${c.email ?? ""} ${c.tags.join(" ")}`.toLowerCase().includes(q));
  }, [clients, query]);

  const ids = [...selected];
  const picked = () => clients.filter((c) => selected.has(c.id));
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, clear = false) =>
    start(async () => { const res = await fn(); setMsg(res); if (!res.error && clear) setSelected(new Set()); });
  const change = (patch: BulkChange) => run(() => bulkUpdate("crm_companies", ids, patch));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = picked().map((c) => [c.name, statusLabel(c.status), c.industry ?? "", c.email ?? "", c.phone ?? "", c.website ?? "", String(c.contacts), String(c.open_value / 100), String(c.won_value / 100), ownerName(staff, c.owner_id) ?? "", c.tags.join("; ")].map(esc).join(","));
    downloadCsv("clients.csv", ["Client,Status,Industry,Email,Phone,Website,Contacts,Open pipeline,Won,Owner,Tags", ...rows].join("\n"));
  };

  const bulk: BulkAction[] = [
    ...(readOnly ? [] : [
      { label: "Status", icon: Flag, options: COMPANY_STATUSES.map((s) => ({ value: s.id, label: s.label })), onPick: (v: string) => change({ status: v }) },
      { label: "Owner", icon: UserRound, options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))], onPick: (v: string) => change({ owner_id: v || null }) },
      { label: "Add tags", icon: Tag, input: { placeholder: "Tags, comma separated", submit: "Add tags", onSubmit: (v: string) => change({ add_tags: v }) } },
      { label: "Remove tags", icon: TagsIcon, input: { placeholder: "Tags to remove", submit: "Remove tags", onSubmit: (v: string) => change({ remove_tags: v }) } },
    ]),
    { label: "Email", icon: Mail, run: () => { const missing = emailEveryone(picked().map((c) => c.email)); if (missing) setMsg({ ok: `${missing} selected have no email address.` }); } },
    { label: "Export", icon: Download, run: exportCsv },
    ...(readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true,
      run: () => confirm(`Delete ${ids.length} clients? Their contacts are kept but unlinked.`) && run(() => bulkDelete("crm_companies", ids), true) }]),
  ];

  const columns: Column<ClientRow>[] = [
    { id: "name", label: "Client", value: (c) => c.name, cell: (c) => (
      <span className="flex items-center gap-2"><Building2 className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block truncate font-medium">{c.name}</span>
        {c.industry && <span className="block truncate text-xs text-muted-foreground">{c.industry}</span>}</span></span>) },
    { id: "status", label: "Status", cell: (c) => <Badge variant={c.status === "client" ? "default" : "outline"}>{statusLabel(c.status)}</Badge>, value: (c) => statusLabel(c.status), filter: true },
    { id: "industry", label: "Industry", cell: (c) => plain(c.industry), value: (c) => c.industry, filter: true, hidden: true },
    { id: "contacts", label: "Contacts", cell: (c) => c.contacts, value: (c) => c.contacts, className: "text-right tabular-nums" },
    { id: "open", label: "Open pipeline", cell: (c) => (c.open_deals ? `${money(c.open_value)} · ${c.open_deals}` : "—"), value: (c) => c.open_value, className: "text-right tabular-nums" },
    { id: "won", label: "Won", cell: (c) => (c.won_value ? money(c.won_value) : "—"), value: (c) => c.won_value, className: "text-right tabular-nums" },
    { id: "email", label: "Email", cell: (c) => plain(c.email), value: (c) => c.email, hidden: true },
    { id: "phone", label: "Phone", cell: (c) => plain(c.phone), value: (c) => c.phone, hidden: true },
    { id: "tags", label: "Tags", cell: (c) => c.tags.join(", ") || "—", value: (c) => c.tags, filter: true, hidden: true },
    { id: "owner", label: "Owner", cell: (c) => plain(ownerName(staff, c.owner_id)), value: (c) => ownerName(staff, c.owner_id), filter: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Search clients…" />
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
          {!readOnly && <AddCompanyButton staff={staff} />}
        </div>
      </div>
      <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((c) => c.id)))} actions={bulk} />
      {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}

      {shown.length === 0 ? (
        <EmptyState message={clients.length ? "No clients match." : "No clients yet."} />
      ) : view === "map" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {shown.filter((c) => c.latitude != null).length} of {shown.length} on the map.
            {shown.some((c) => c.address && !c.geocoded_address) && !readOnly && (
              <button type="button" className="text-primary underline-offset-2 hover:underline" disabled={pending} onClick={() => run(() => geocodeClients())}>
                {pending ? "Placing…" : "Place clients that have addresses"}
              </button>
            )}
            {shown.some((c) => !c.address) && <span>Clients without an address aren&apos;t shown.</span>}
          </div>
          <ClientsMap points={shown.filter((c) => c.latitude != null && c.longitude != null).map((c) => ({
            id: c.id, name: c.name, lat: c.latitude!, lng: c.longitude!, color: c.status, sub: [statusLabel(c.status), c.address].filter(Boolean).join(" · "),
          }))} />
        </div>
      ) : view === "table" ? (
        <DataTable rows={shown} columns={columns} getId={(c) => c.id} selected={selected} onSelect={setSelected} onOpen={(c) => router.push(`/admin/clients/${c.id}`)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-xl border p-4 hover:bg-muted/40">
              <input type="checkbox" className="mt-1" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
              <button type="button" onClick={() => router.push(`/admin/clients/${c.id}`)} className="min-w-0 flex-1 space-y-2 text-left">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  <Badge variant={c.status === "client" ? "default" : "outline"}>{statusLabel(c.status)}</Badge>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {c.contacts} contacts · {c.open_deals ? `${money(c.open_value)} open` : "no open deals"}{c.won_value ? ` · ${money(c.won_value)} won` : ""}
                </span>
                {c.tags.length > 0 && <span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
