"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./crm-kit";

// A column: how to show it, and optionally how to sort and filter by it.
// `value` gives the sort key and the filter values (an array for tags).
export type Column<T> = {
  id: string; label: string; cell: (row: T) => React.ReactNode;
  value?: (row: T) => string | number | null | string[];
  filter?: boolean; hidden?: boolean; className?: string;
};

type Sort = { id: string; dir: "asc" | "desc" } | null;

const text = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const valuesOf = (v: string | number | null | string[]) => (Array.isArray(v) ? v : [text(v)]);

// The table view for CRM lists: sort by clicking a header, choose columns,
// add filters (any filterable column, any of its values), select rows.
export function DataTable<T>({ rows, columns, getId, selected, onSelect, onOpen, rowEnd }: {
  rows: T[]; columns: Column<T>[]; getId: (row: T) => string; selected: Set<string>; onSelect: (next: Set<string>) => void;
  onOpen: (row: T) => void; rowEnd?: (row: T) => React.ReactNode;
}) {
  const [visible, setVisible] = useState(() => new Set(columns.filter((c) => !c.hidden).map((c) => c.id)));
  const [sort, setSort] = useState<Sort>(null);
  const [filters, setFilters] = useState<{ id: string; values: string[] }[]>([]);

  const options = useMemo(() => Object.fromEntries(columns.filter((c) => c.filter && c.value).map((c) => [c.id,
    [...new Set(rows.flatMap((r) => valuesOf(c.value!(r))))].sort((a, b) => a.localeCompare(b))])), [rows, columns]);

  const shown = useMemo(() => {
    let out = rows.filter((r) => filters.every((f) => {
      const col = columns.find((c) => c.id === f.id);
      return !col?.value || !f.values.length || valuesOf(col.value(r)).some((v) => f.values.includes(v));
    }));
    const col = sort && columns.find((c) => c.id === sort.id);
    if (col?.value) {
      const key = (r: T) => { const v = col.value!(r); return Array.isArray(v) ? v.join(", ") : v; };
      out = [...out].sort((a, b) => {
        const x = key(a), y = key(b);
        const cmp = x == null ? 1 : y == null ? -1 : typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort!.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, columns, filters, sort]);

  const cols = columns.filter((c) => visible.has(c.id));
  const allSelected = shown.length > 0 && shown.every((r) => selected.has(getId(r)));
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); onSelect(n); };
  const toggleAll = () => { const n = new Set(selected); shown.forEach((r) => (allSelected ? n.delete(getId(r)) : n.add(getId(r)))); onSelect(n); };
  const cycle = (id: string) => setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
  const setValues = (id: string, values: string[]) => setFilters((fs) => fs.map((f) => (f.id === id ? { ...f, values } : f)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}><ListFilter /> Add filter</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {columns.filter((c) => c.filter && c.value && !filters.some((f) => f.id === c.id)).map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setFilters((fs) => [...fs, { id: c.id, values: [] }])}>{c.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {filters.map((f) => {
          const col = columns.find((c) => c.id === f.id)!;
          return (
            <span key={f.id} className="flex items-center rounded-lg border bg-muted/40 text-sm">
              <DropdownMenu>
                <DropdownMenuTrigger render={<button type="button" className="px-2.5 py-1" />}>
                  <span className="text-muted-foreground">{col.label}:</span> {f.values.length ? (f.values.length > 2 ? `${f.values.length} selected` : f.values.join(", ")) : "any"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-56">
                  {(options[f.id] ?? []).map((v) => (
                    <DropdownMenuCheckboxItem key={v} checked={f.values.includes(v)} closeOnClick={false}
                      onCheckedChange={(on) => setValues(f.id, on ? [...f.values, v] : f.values.filter((x) => x !== v))}>{v}</DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" aria-label={`Remove ${col.label} filter`} className="pr-2 text-muted-foreground hover:text-foreground"
                onClick={() => setFilters((fs) => fs.filter((x) => x.id !== f.id))}><X className="size-3.5" /></button>
            </span>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">{shown.length} of {rows.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}><Columns3 /> Columns</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={visible.has(c.id)} closeOnClick={false}
                  onCheckedChange={(on) => setVisible((v) => { const n = new Set(v); if (on) n.add(c.id); else if (n.size > 1) n.delete(c.id); return n; })}>{c.label}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {shown.length === 0 ? <EmptyState message="Nothing matches these filters." /> : (
        <div className="rounded-xl border bg-card px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></TableHead>
                {cols.map((c) => (
                  <TableHead key={c.id} className={c.className}>
                    {c.value ? (
                      <button type="button" onClick={() => cycle(c.id)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {c.label}
                        {sort?.id === c.id ? (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : c.label}
                  </TableHead>
                ))}
                {rowEnd && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const id = getId(r);
                return (
                  <TableRow key={id} data-state={selected.has(id) ? "selected" : undefined} className="cursor-pointer" onClick={() => onOpen(r)}>
                    <TableCell onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label="Select row" /></TableCell>
                    {cols.map((c) => <TableCell key={c.id} className={cn("max-w-64 truncate", c.className)}>{c.cell(r)}</TableCell>)}
                    {rowEnd && <TableCell onClick={(e) => e.stopPropagation()}>{rowEnd(r)}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export const plain = text;
