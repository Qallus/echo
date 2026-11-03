"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CalendarClock, Columns3, Rows3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moveDeal } from "@/lib/admin/actions/crm";
import { money } from "@/lib/billing/catalog";
import { DEAL_STAGES, closedRecently, contactName, formatDay, isOverdue, ownerName, type Contact, type Deal, type DealStage, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { FILTER, SELECT, StageLabel } from "./crm-ui";
import { AddDealButton } from "./record-actions";


function NextStep({ d }: { d: Deal }) {
  if (!d.next_step && !d.next_step_due) return null;
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", isOverdue(d.next_step_due) && d.stage !== "won" && d.stage !== "lost" && "font-medium text-destructive")}>
      <CalendarClock className="size-3 shrink-0" />
      <span className="truncate">{d.next_step ?? "Next step"}{d.next_step_due ? ` · ${formatDay(d.next_step_due)}` : ""}</span>
    </p>
  );
}

// Deals by stage. Drag a card to another column (or use its stage menu on
// a phone); the table view lists everything with the same filters.
export function PipelineBoard({ deals, companies, contacts, staff, readOnly }: {
  deals: Deal[]; companies: { id: string; name: string }[]; contacts: Contact[]; staff: StaffOption[]; readOnly: boolean;
}) {
  const [list, setList] = useState(deals);
  const [prev, setPrev] = useState(deals);
  if (deals !== prev) { setPrev(deals); setList(deals); }
  const [view, setView] = useState<"board" | "table">("board");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const [allClosed, setAllClosed] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<DealStage | null>(null);
  const [error, setError] = useState<string>();
  const [, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((d) =>
      (!owner || d.owner_id === owner)
      && (allClosed || closedRecently(d.closed_at))
      && (!q || `${d.title} ${d.company?.name ?? ""} ${d.contact ? contactName(d.contact) : ""}`.toLowerCase().includes(q)));
  }, [list, query, owner, allClosed]);

  const move = (id: string, stage: DealStage) => {
    const before = list;
    const deal = list.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    setList(list.map((d) => (d.id === id ? { ...d, stage, closed_at: stage === "won" || stage === "lost" ? new Date().toISOString() : null } : d)));
    start(async () => {
      const res = await moveDeal(id, stage);
      setError(res.error);
      if (res.error) setList(before);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals, clients, contacts" className="pl-8" aria-label="Search deals" />
        </div>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={FILTER} aria-label="Owner">
          <option value="">All owners</option>
          {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={allClosed} onChange={(e) => setAllClosed(e.target.checked)} /> Older won/lost
        </label>
        <div className="flex rounded-lg border p-0.5">
          <Button variant={view === "board" ? "secondary" : "ghost"} size="icon-sm" aria-label="Board view" onClick={() => setView("board")}><Columns3 /></Button>
          <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" aria-label="Table view" onClick={() => setView("table")}><Rows3 /></Button>
        </div>
        {!readOnly && <span className="ml-auto"><AddDealButton companies={companies} contacts={contacts} staff={staff} /></span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {view === "board" ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {DEAL_STAGES.map((s) => {
            const items = shown.filter((d) => d.stage === s.id);
            const total = items.reduce((n, d) => n + d.value_cents, 0);
            return (
              <section key={s.id} aria-label={s.label}
                className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30", over === s.id && "ring-2 ring-ring")}
                onDragOver={(e) => { if (dragging && !readOnly) { e.preventDefault(); setOver(s.id); } }}
                onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); if (dragging) move(dragging, s.id); setDragging(null); }}>
                <header className="flex items-center gap-2 border-b px-3 py-2">
                  <span className={cn("size-2 rounded-full", s.dot)} />
                  <h3 className="text-sm font-medium">{s.label}</h3>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{money(total)}</span>
                </header>
                <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                  {items.map((d) => (
                    <article key={d.id} draggable={!readOnly}
                      onDragStart={(e) => { setDragging(d.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      className={cn("group space-y-1.5 rounded-lg border bg-card p-3 shadow-xs", !readOnly && "cursor-grab active:cursor-grabbing", dragging === d.id && "opacity-50")}>
                      <Link href={`/admin/pipeline/${d.id}`} className="block text-sm font-medium leading-snug hover:underline">{d.title}</Link>
                      {(d.company || d.contact) && (
                        <p className="truncate text-xs text-muted-foreground">{[d.company?.name, d.contact && contactName(d.contact)].filter(Boolean).join(" · ")}</p>
                      )}
                      <NextStep d={d} />
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-sm font-medium tabular-nums">{money(d.value_cents, d.currency)}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{ownerName(staff, d.owner_id)}</span>
                      </div>
                      {!readOnly && (
                        <select value={d.stage} onChange={(e) => move(d.id, e.target.value as DealStage)} aria-label={`Move ${d.title}`}
                          className={cn(SELECT, "h-7 text-xs sm:hidden")}>
                          {DEAL_STAGES.map((x) => <option key={x.id} value={x.id}>Move to {x.label}</option>)}
                        </select>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : shown.length === 0 ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No deals match.</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead><TableHead>Client</TableHead><TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead><TableHead>Close</TableHead><TableHead>Next step</TableHead><TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="max-w-64 truncate"><Link href={`/admin/pipeline/${d.id}`} className="font-medium hover:underline">{d.title}</Link></TableCell>
                <TableCell className="text-muted-foreground">{d.company ? <Link href={`/admin/clients/${d.company.id}`} className="hover:underline">{d.company.name}</Link> : "—"}</TableCell>
                <TableCell><StageLabel stage={d.stage} /></TableCell>
                <TableCell className="text-right tabular-nums">{money(d.value_cents, d.currency)}</TableCell>
                <TableCell className="text-muted-foreground">{d.expected_close ? formatDay(d.expected_close) : "—"}</TableCell>
                <TableCell className="max-w-56"><NextStep d={d} /></TableCell>
                <TableCell className="text-muted-foreground">{ownerName(staff, d.owner_id) ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
