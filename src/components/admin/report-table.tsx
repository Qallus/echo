"use client";

import { useState, useTransition } from "react";
import { Download, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteReport, saveReport } from "@/lib/admin/actions/reports";
import type { Column, ReportDef, SavedReport } from "@/lib/admin/reports";
import { STAGES, type DealStage } from "@/lib/crm/deals";
import { cn } from "@/lib/utils";

const NUMERIC = new Set(["count", "money", "percent", "days"]);

function show(v: unknown, c: Column) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  switch (c.format) {
    case "money": return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "percent": return `${n}%`;
    case "days": return `${n} d`;
    case "count": return n.toLocaleString();
    case "stage": return STAGES[v as DealStage]?.label ?? String(v);
    default: return String(v);
  }
}

// CSV keeps plain numbers (dollars, not cents) so spreadsheets can add them up.
function csvValue(v: unknown, c: Column) {
  if (v == null) return "";
  const s = c.format === "money" ? (Number(v) / 100).toFixed(2) : c.format === "stage" ? show(v, c) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReportTable({ def, rows, range, since, until, saved }: {
  def: ReportDef; rows: Record<string, unknown>[]; range: string; since: string; until: string; saved: SavedReport[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(def.title);
  const [shared, setShared] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const totals = def.columns.map((c) => (c.format === "count" || c.format === "money" ? rows.reduce((n, r) => n + Number(r[c.key] ?? 0), 0) : null));

  const exportCsv = () => {
    const lines = [def.columns.map((c) => c.label).join(","), ...rows.map((r) => def.columns.map((c) => csvValue(r[c.key], c)).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${def.kind}_${since}_${until}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download /> Export CSV</Button>
        <Button variant="outline" size="sm" onClick={() => { setMsg({}); setOpen(true); }}><Save /> Save report</Button>
        {saved.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {s.name}
            <button type="button" aria-label={`Delete saved report ${s.name}`} className="hover:text-destructive" disabled={pending}
              onClick={() => { if (confirm(`Delete "${s.name}"?`)) start(async () => { await deleteReport(s.id); }); }}><Trash2 className="size-3" /></button>
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nothing in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>{def.columns.map((c) => <TableHead key={c.key} className={cn(NUMERIC.has(c.format) && "text-right")}>{c.label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {def.columns.map((c) => <TableCell key={c.key} className={cn(NUMERIC.has(c.format) && "text-right tabular-nums", c.format === "text" && "max-w-xs truncate")}>{show(r[c.key], c)}</TableCell>)}
                </TableRow>
              ))}
              {rows.length > 1 && totals.some((t) => t !== null) && (
                <TableRow className="font-medium">
                  {def.columns.map((c, i) => <TableCell key={c.key} className={cn(NUMERIC.has(c.format) && "text-right tabular-nums")}>{i === 0 ? "Total" : totals[i] === null ? "" : show(totals[i], c)}</TableCell>)}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Save report" description="Keeps this report and date range in the Reports list.">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveReport({ name, kind: def.kind, range, since, until, shared });
              setMsg(res);
              if (res.ok) setOpen(false);
            });
          }}>
            <div className="space-y-1.5"><Label htmlFor="rep-name">Name</Label><Input id="rep-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={shared} onCheckedChange={(v) => setShared(Boolean(v))} /> Share with staff who can see reports</label>
            <p className="text-xs text-muted-foreground">{range === "custom" ? `Always ${since} to ${until}.` : "The range moves with today, e.g. always the last 90 days."}</p>
            {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
            <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
