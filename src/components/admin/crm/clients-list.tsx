"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, LayoutGrid, Rows3, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/billing/catalog";
import { COMPANY_STATUSES, type Company, type CompanyStatus, type StaffOption } from "@/lib/crm/types";
import { FILTER, ownerName } from "./crm-ui";
import { AddCompanyButton } from "./record-actions";

export type ClientRow = Company & { contacts: number; open_deals: number; open_value: number; won_value: number };

const statusLabel = (s: CompanyStatus) => COMPANY_STATUSES.find((x) => x.id === s)?.label ?? s;

// Searchable client list with contact and pipeline totals.
export function ClientsList({ clients, staff, readOnly }: { clients: ClientRow[]; staff: StaffOption[]; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) =>
      (!status || c.status === status)
      && (!q || `${c.name} ${c.industry ?? ""} ${c.email ?? ""} ${c.tags.join(" ")}`.toLowerCase().includes(q)));
  }, [clients, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" className="pl-8" aria-label="Search clients" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={FILTER} aria-label="Status">
          <option value="">All statuses</option>
          {COMPANY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="flex rounded-lg border p-0.5">
          <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" aria-label="Table view" onClick={() => setView("table")}><Rows3 /></Button>
          <Button variant={view === "cards" ? "secondary" : "ghost"} size="icon-sm" aria-label="Card view" onClick={() => setView("cards")}><LayoutGrid /></Button>
        </div>
        <span className="text-sm text-muted-foreground">{shown.length} of {clients.length}</span>
        {!readOnly && <span className="ml-auto"><AddCompanyButton staff={staff} /></span>}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{clients.length ? "No clients match." : "No clients yet."}</p>
      ) : view === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Contacts</TableHead>
              <TableHead className="text-right">Open pipeline</TableHead><TableHead className="text-right">Won</TableHead><TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-2 hover:underline">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      {c.industry && <span className="block truncate text-xs text-muted-foreground">{c.industry}</span>}
                    </span>
                  </Link>
                </TableCell>
                <TableCell><Badge variant={c.status === "client" ? "default" : "outline"}>{statusLabel(c.status)}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{c.contacts}</TableCell>
                <TableCell className="text-right tabular-nums">{c.open_deals ? `${money(c.open_value)} · ${c.open_deals}` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{c.won_value ? money(c.won_value) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{ownerName(staff, c.owner_id) ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Link key={c.id} href={`/admin/clients/${c.id}`} className="space-y-2 rounded-xl border p-4 hover:bg-muted/40">
              <span className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                <Badge variant={c.status === "client" ? "default" : "outline"}>{statusLabel(c.status)}</Badge>
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.contacts} contacts · {c.open_deals ? `${money(c.open_value)} open` : "no open deals"}{c.won_value ? ` · ${money(c.won_value)} won` : ""}
              </span>
              {c.tags.length > 0 && <span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
