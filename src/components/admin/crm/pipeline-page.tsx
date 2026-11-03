"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Download, Flag, UserRound, ChevronLeft, ChevronRight, ExternalLink, Eye, GitBranchPlus, LayoutGrid, List, Pencil, Plus, Table as TableIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteDeal, moveDeal } from "@/lib/admin/actions/crm";
import { bulkDelete, bulkUpdate } from "@/lib/admin/actions/crm-bulk";
import { downloadCsv } from "@/lib/crm/csv";
import { money } from "@/lib/billing/catalog";
import { OPEN_STAGES, STAGES, STAGE_ORDER, weighted, type DealStage } from "@/lib/crm/deals";
import { closedRecently, contactName, formatDay, ownerName, type Contact, type Deal, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { DetailRow, EmptyState, RecordCalendar, RowActions, SearchBox, StageBadge, StatRow, StatTile, ViewSwitcher, type RowAction } from "./crm-kit";
import { FILTER } from "./crm-ui";
import { BulkBar, type BulkAction } from "./bulk-bar";
import { DataTable, plain, type Column } from "./data-table";
import { DealDialog } from "./record-dialogs";

type View = "board" | "list" | "table" | "cards" | "calendar";
const VIEWS = [
  { id: "board" as const, label: "Board", icon: GitBranchPlus },
  { id: "list" as const, label: "List", icon: List },
  { id: "table" as const, label: "Table", icon: TableIcon },
  { id: "cards" as const, label: "Cards", icon: LayoutGrid },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
];

const who = (d: Deal) => [d.company?.name, d.contact && contactName(d.contact)].filter(Boolean).join(" · ");

// Opportunities by stage, with a weighted forecast. Ported from Channel-Cast's
// pipeline page; every deal opens its workspace.
export function PipelinePage({ deals, companies, contacts, staff, readOnly }: {
  deals: Deal[]; companies: { id: string; name: string }[]; contacts: Contact[]; staff: StaffOption[]; readOnly: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(deals);
  const [prev, setPrev] = useState(deals);
  if (deals !== prev) { setPrev(deals); setList(deals); }
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const [allClosed, setAllClosed] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((d) => (!owner || d.owner_id === owner) && (allClosed || closedRecently(d.closed_at))
      && (!q || `${d.title} ${who(d)} ${ownerName(staff, d.owner_id) ?? ""}`.toLowerCase().includes(q)));
  }, [list, search, owner, allClosed, staff]);

  const stats = useMemo(() => {
    const open = list.filter((d) => OPEN_STAGES.includes(d.stage));
    const won = list.filter((d) => d.stage === "closed_won");
    const decided = won.length + list.filter((d) => d.stage === "closed_lost").length;
    return {
      openCount: open.length, openValue: open.reduce((n, d) => n + d.value_cents, 0),
      forecast: open.reduce((n, d) => n + weighted(d), 0), wonValue: won.reduce((n, d) => n + d.value_cents, 0),
      winRate: decided ? Math.round((won.length / decided) * 100) : 0,
    };
  }, [list]);

  const open = (id: string) => router.push(`/admin/pipeline/${id}`);
  const move = (d: Deal, stage: DealStage) => {
    if (readOnly || d.stage === stage) return;
    const before = list;
    setList(list.map((x) => (x.id === d.id ? { ...x, stage, probability: STAGES[stage].prob } : x)));
    start(async () => { const res = await moveDeal(d.id, stage); setMsg(res); if (res.error) setList(before); });
  };
  const remove = (d: Deal) => {
    if (!confirm(`Delete "${d.title}"? This can't be undone.`)) return;
    start(async () => { const res = await deleteDeal(d.id); setMsg(res); if (!res.error) setQuick(null); });
  };
  const actions = (d: Deal): RowAction[] => [
    { label: "Open workspace", icon: ExternalLink, onClick: () => open(d.id) },
    { label: "Quick view", icon: Eye, onClick: () => setQuick(d.id) },
    ...(readOnly ? [] : [
      { label: "Edit", icon: Pencil, onClick: () => setEditing(d) },
      { label: "Delete", icon: Trash2, onClick: () => remove(d), destructive: true },
    ]),
  ];
  const q = list.find((d) => d.id === quick) ?? null;
  const ids = [...selected];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const box = (d: Deal) => <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${d.title}`} />;
  const bulkRun = (fn: () => Promise<{ ok?: string; error?: string }>, clear = false) =>
    start(async () => { const res = await fn(); setMsg(res); if (!res.error && clear) setSelected(new Set()); });
  const exportCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = list.filter((d) => selected.has(d.id)).map((d) => [d.title, who(d), STAGES[d.stage].label, String(d.value_cents / 100), `${d.probability}%`, d.expected_close ?? "", ownerName(staff, d.owner_id) ?? "", d.source ?? ""].map(esc).join(","));
    downloadCsv("pipeline.csv", ["Deal,Client,Stage,Value,Probability,Expected close,Owner,Source", ...rows].join("\n"));
  };
  const bulk: BulkAction[] = [
    ...(readOnly ? [] : [
      { label: "Stage", icon: Flag, options: STAGE_ORDER.map((s) => ({ value: s, label: STAGES[s].label })), onPick: (v: string) => bulkRun(() => bulkUpdate("crm_deals", ids, { stage: v })) },
      { label: "Owner", icon: UserRound, options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))], onPick: (v: string) => bulkRun(() => bulkUpdate("crm_deals", ids, { owner_id: v || null })) },
    ]),
    { label: "Export", icon: Download, run: exportCsv },
    ...(readOnly ? [] : [{ label: "Delete", icon: Trash2, destructive: true, run: () => confirm(`Delete ${ids.length} deals? This can't be undone.`) && bulkRun(() => bulkDelete("crm_deals", ids), true) }]),
  ];
  const columns: Column<Deal>[] = [
    { id: "title", label: "Deal", cell: (d) => <span className="font-medium">{d.title}</span>, value: (d) => d.title },
    { id: "client", label: "Client", cell: (d) => plain(who(d)), value: (d) => d.company?.name ?? null, filter: true },
    { id: "stage", label: "Stage", cell: (d) => <StageBadge stage={d.stage} />, value: (d) => STAGES[d.stage].label, filter: true },
    { id: "value", label: "Value", cell: (d) => money(d.value_cents, d.currency), value: (d) => d.value_cents, className: "text-right tabular-nums" },
    { id: "prob", label: "Prob.", cell: (d) => `${d.probability}%`, value: (d) => d.probability, className: "text-right" },
    { id: "weighted", label: "Weighted", cell: (d) => money(weighted(d)), value: (d) => weighted(d), className: "text-right tabular-nums", hidden: true },
    { id: "close", label: "Close", cell: (d) => (d.expected_close ? formatDay(d.expected_close) : "—"), value: (d) => d.expected_close },
    { id: "type", label: "Type", cell: (d) => plain(d.opportunity_type), value: (d) => d.opportunity_type, filter: true, hidden: true },
    { id: "source", label: "Source", cell: (d) => plain(d.source), value: (d) => d.source, filter: true, hidden: true },
    { id: "next", label: "Next step", cell: (d) => plain(d.next_step), value: (d) => d.next_step_due, hidden: true },
    { id: "owner", label: "Owner", cell: (d) => plain(ownerName(staff, d.owner_id)), value: (d) => ownerName(staff, d.owner_id), filter: true },
    { id: "updated", label: "Updated", cell: (d) => new Date(d.updated_at).toLocaleDateString(), value: (d) => d.updated_at, hidden: true },
  ];

  return (
    <div className="space-y-6">
      <StatRow>
        <StatTile label="Open deals" value={stats.openCount} hint={money(stats.openValue)} />
        <StatTile label="Weighted forecast" value={money(stats.forecast)} hint="Value × probability" accent />
        <StatTile label="Won" value={money(stats.wonValue)} />
        <StatTile label="Win rate" value={`${stats.winRate}%`} />
      </StatRow>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search deals…" />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={FILTER} aria-label="Owner">
            <option value="">All owners</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={allClosed} onChange={(e) => setAllClosed(e.target.checked)} /> Older closed deals
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
          {!readOnly && <Button onClick={() => setEditing("new")}><Plus /> Add deal</Button>}
        </div>
      </div>
      <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((d) => d.id)))} actions={bulk} />
      {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}

      {shown.length === 0 && view !== "board" ? (
        <EmptyState message={list.length ? "No deals match your filters." : "No deals yet. Add your first opportunity."} />
      ) : view === "board" ? (
        <BoardView deals={shown} staff={staff} readOnly={readOnly} onOpen={open} onMove={move} box={box} />
      ) : view === "list" ? (
        <div className="space-y-2">
          {shown.map((d) => (
            <div key={d.id} role="button" tabIndex={0} onClick={() => open(d.id)} onKeyDown={(e) => e.key === "Enter" && open(d.id)}
              className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40">
              {box(d)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{d.title}</p><StageBadge stage={d.stage} /></div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{who(d) || "No client"}{d.expected_close ? ` · closes ${formatDay(d.expected_close)}` : ""}</p>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">{d.probability}%</span>
              <span className="text-sm font-semibold tabular-nums">{money(d.value_cents, d.currency)}</span>
              <RowActions actions={actions(d)} />
            </div>
          ))}
        </div>
      ) : view === "table" ? (
        <DataTable rows={shown} columns={columns} getId={(d) => d.id} selected={selected} onSelect={setSelected} onOpen={(d) => open(d.id)} rowEnd={(d) => <RowActions actions={actions(d)} />} />
      ) : view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <div key={d.id} role="button" tabIndex={0} onClick={() => open(d.id)} onKeyDown={(e) => e.key === "Enter" && open(d.id)}
              className="cursor-pointer space-y-3 rounded-xl border bg-card p-4 hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <span className="pt-1">{box(d)}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.title}</p><p className="truncate text-xs text-muted-foreground">{who(d) || "No client"}</p></div>
                <RowActions actions={actions(d)} />
              </div>
              <StageBadge stage={d.stage} />
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">{d.probability}%{d.expected_close ? ` · ${formatDay(d.expected_close)}` : ""}</span>
                <span className="font-semibold tabular-nums">{money(d.value_cents, d.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <RecordCalendar items={shown} getId={(d) => d.id} getDate={(d) => d.expected_close} getTitle={(d) => d.title} onOpen={open}
          footer="Deals placed by expected close date. Click one to open its workspace." />
      )}

      <Sheet open={Boolean(q)} onOpenChange={(o) => !o && setQuick(null)}>
        <SheetContent className="overflow-y-auto p-5 sm:max-w-md">
          {q && (
            <div className="space-y-5">
              <SheetHeader className="p-0">
                <SheetTitle>{q.title}</SheetTitle>
                <p className="text-sm text-muted-foreground">{who(q) || "No client"}</p>
              </SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={q.stage} />
                <span className="text-lg font-semibold tabular-nums">{money(q.value_cents, q.currency)}</span>
                <span className="text-sm text-muted-foreground">· {q.probability}% likely</span>
              </div>
              <div>
                <DetailRow label="Weighted">{money(weighted(q))}</DetailRow>
                <DetailRow label="Expected close">{q.expected_close ? formatDay(q.expected_close) : null}</DetailRow>
                <DetailRow label="Owner">{ownerName(staff, q.owner_id)}</DetailRow>
                <DetailRow label="Type">{q.opportunity_type}</DetailRow>
                <DetailRow label="Products">{q.products.length ? q.products.join(", ") : null}</DetailRow>
                <DetailRow label="Source">{q.source}</DetailRow>
                <DetailRow label="Next step">{q.next_step ? `${q.next_step}${q.next_step_due ? ` · ${formatDay(q.next_step_due)}` : ""}` : null}</DetailRow>
              </div>
              {!readOnly && (
                <div>
                  <p className="mb-1.5 text-xs tracking-wide text-muted-foreground uppercase">Move to stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGE_ORDER.map((s) => (
                      <Button key={s} size="sm" variant={s === q.stage ? "default" : "outline"} onClick={() => move(q, s)}>{STAGES[s].label}</Button>
                    ))}
                  </div>
                </div>
              )}
              {q.notes && <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{q.notes}</p>}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => open(q.id)}><ExternalLink /> Open workspace</Button>
                {!readOnly && <Button variant="outline" onClick={() => setEditing(q)}><Pencil /> Edit</Button>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editing && (
        <DealDialog open onOpenChange={(o) => !o && setEditing(null)} deal={editing === "new" ? undefined : editing}
          companies={companies} contacts={contacts} staff={staff} stay={editing !== "new"} />
      )}
    </div>
  );
}

function BoardView({ deals, staff, readOnly, onOpen, onMove, box }: {
  deals: Deal[]; staff: StaffOption[]; readOnly: boolean; onOpen: (id: string) => void; onMove: (d: Deal, s: DealStage) => void; box: (d: Deal) => React.ReactNode;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<DealStage | null>(null);
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {STAGE_ORDER.map((stage, idx) => {
        const col = deals.filter((d) => d.stage === stage);
        return (
          <section key={stage} aria-label={STAGES[stage].label}
            className={cn("flex w-64 shrink-0 flex-col rounded-xl border bg-card p-2", over === stage && "ring-2 ring-ring")}
            onDragOver={(e) => { if (dragging && !readOnly) { e.preventDefault(); setOver(stage); } }}
            onDragLeave={() => setOver((o) => (o === stage ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const d = deals.find((x) => x.id === dragging); if (d) onMove(d, stage); setDragging(null); }}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-1.5"><StageBadge stage={stage} /><span className="text-xs text-muted-foreground">{col.length}</span></span>
              <span className="text-xs tabular-nums text-muted-foreground">{money(col.reduce((n, d) => n + d.value_cents, 0))}</span>
            </div>
            <div className="flex min-h-20 flex-1 flex-col gap-2">
              {col.map((d) => (
                <article key={d.id} draggable={!readOnly}
                  onDragStart={(e) => { setDragging(d.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  className={cn("rounded-md border bg-background p-2.5", !readOnly && "cursor-grab active:cursor-grabbing", dragging === d.id && "opacity-50")}>
                  <div className="flex items-start gap-2">
                  <span className="pt-0.5">{box(d)}</span>
                  <button type="button" onClick={() => onOpen(d.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{who(d) || "No client"}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs font-semibold tabular-nums">{money(d.value_cents, d.currency)}</span>
                      <span className="text-[11px] text-muted-foreground">{d.probability}%</span>
                    </div>
                  </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="truncate text-[10px] text-muted-foreground">
                      {[d.expected_close && formatDay(d.expected_close), ownerName(staff, d.owner_id)].filter(Boolean).join(" · ")}
                    </span>
                    {!readOnly && (
                      <span className="flex shrink-0 gap-1">
                        {idx > 0 && <Button variant="outline" size="icon-xs" aria-label="Move back" onClick={() => onMove(d, STAGE_ORDER[idx - 1])}><ChevronLeft /></Button>}
                        {idx < STAGE_ORDER.length - 1 && <Button variant="outline" size="icon-xs" aria-label="Move forward" onClick={() => onMove(d, STAGE_ORDER[idx + 1])}><ChevronRight /></Button>}
                      </span>
                    )}
                  </div>
                </article>
              ))}
              {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground/60">Empty</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
