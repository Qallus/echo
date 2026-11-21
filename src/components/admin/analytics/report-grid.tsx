"use client";

import { Download } from "lucide-react";
import { downloadCsv } from "@/components/admin/list-csv";
import { Button } from "@/components/ui/button";
import { useColumnWidths } from "@/components/ui/column-resize";
import { cn } from "@/lib/utils";

// A small report table for Analytics: resizable columns, numbers right-aligned,
// an optional share bar on one column, and CSV export.

export type Fmt = "text" | "count" | "money" | "percent" | "number";
export type GridColumn = { key: string; label: string; format?: Fmt; bar?: boolean };
type Row = Record<string, string | number | null | undefined>;

export const fmt = (v: unknown, f: Fmt = "text") => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (f === "count") return Math.round(n).toLocaleString();
  if (f === "number") return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (f === "money") return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 100000 ? 0 : 2 });
  if (f === "percent") return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
  return String(v);
};

export function ReportGrid({ id, title, columns, rows, empty = "Nothing yet for this period.", note }: {
  id: string; title: string; columns: GridColumn[]; rows: Row[]; empty?: string; note?: React.ReactNode;
}) {
  const w = useColumnWidths(`analytics:${id}`);
  const barCol = columns.find((c) => c.bar);
  const max = barCol ? Math.max(1, ...rows.map((r) => Number(r[barCol.key] ?? 0))) : 1;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
        {rows.length > 0 && (
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => downloadCsv(`${id}.csv`, columns.map((c) => c.label), rows.map((r) => columns.map((c) => (c.format === "money" ? Number(r[c.key] ?? 0) / 100 : r[c.key] ?? ""))))}>
            <Download /> CSV
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm" style={w.tableStyle}>
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} data-col={c.key} style={w.width(c.key)} className={cn("relative px-3 py-2 font-medium", c.format && c.format !== "text" ? "text-right" : "text-left", w.sized && "truncate")}>
                    {c.label}{w.handle(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2", c.format && c.format !== "text" ? "text-right tabular-nums" : "max-w-80 truncate", w.sized && "overflow-hidden")}>
                      {c === barCol ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${(Number(r[c.key] ?? 0) / max) * 100}%` }} /></span>
                          {fmt(r[c.key], c.format)}
                        </span>
                      ) : fmt(r[c.key], c.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
