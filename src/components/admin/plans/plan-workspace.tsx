"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Archive, ArrowLeft, CalendarDays, Check, Diamond, Kanban, LayoutGrid, List, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTask, bulkUpdateTasks, deleteGroup, deletePlan, deleteTasks, saveGroup, updatePlan, updateTask } from "@/lib/admin/actions/plans";
import { formatDay, isOverdue, ownerName, type StaffOption } from "@/lib/crm/types";
import { PRIORITIES, TASK_STATUSES, colorDot, type Plan, type PlanGroup, type PlanTask } from "@/lib/plans/types";
import { cn } from "@/lib/utils";
import { BulkBar, type BulkAction } from "@/components/admin/crm/bulk-bar";
import { Editable, EmptyState, RecordCalendar, ViewSwitcher } from "@/components/admin/crm/crm-kit";
import { DataTable, plain, type Column } from "@/components/admin/crm/data-table";
import { TaskDrawer } from "./task-drawer";

type View = Plan["default_view"];
const VIEWS = [
  { id: "board" as const, label: "Board", icon: Kanban }, { id: "list" as const, label: "List", icon: List },
  { id: "grid" as const, label: "Grid", icon: LayoutGrid }, { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
];

function StatusPill({ status }: { status: PlanTask["status"] }) {
  const s = TASK_STATUSES.find((x) => x.id === status)!;
  return <Badge className={cn("border-transparent", s.tone)}>{s.label}</Badge>;
}

// One plan: tasks in columns, with board, list, grid and calendar views.
export function PlanWorkspace({ plan, groups, tasks, staff, companies, readOnly }: {
  plan: Plan; groups: PlanGroup[]; tasks: PlanTask[]; staff: StaffOption[]; companies: { id: string; name: string }[]; readOnly: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(plan.default_view);
  const [list, setList] = useState(tasks);
  const [prev, setPrev] = useState(tasks);
  if (tasks !== prev) { setPrev(tasks); setList(tasks); }
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideDone, setHideDone] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, clear = false) => start(async () => { const r = await fn(); setMsg(r); if (!r.error && clear) setSelected(new Set()); });

  const shown = useMemo(() => list.filter((t) => !hideDone || t.status !== "complete"), [list, hideDone]);
  const done = list.filter((t) => t.status === "complete").length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const open = list.find((t) => t.id === openId) ?? null;
  const ids = [...selected];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const box = (t: PlanTask) => !readOnly && <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${t.title}`} />;
  const complete = (t: PlanTask) => {
    const status = t.status === "complete" ? "not_started" : "complete";
    setList(list.map((x) => (x.id === t.id ? { ...x, status } : x)));
    run(() => updateTask(plan.id, t.id, { status }));
  };
  const moveTo = (taskId: string, groupId: string | null) => {
    setList(list.map((x) => (x.id === taskId ? { ...x, group_id: groupId } : x)));
    run(() => updateTask(plan.id, taskId, { group_id: groupId }));
  };

  const bulk: BulkAction[] = readOnly ? [] : [
    { label: "Status", icon: Check, options: TASK_STATUSES.map((s) => ({ value: s.id, label: s.label })), onPick: (v: string) => run(() => bulkUpdateTasks(plan.id, ids, { status: v as PlanTask["status"] }), true) },
    { label: "Assign", icon: UserRound, options: [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))], onPick: (v: string) => run(() => bulkUpdateTasks(plan.id, ids, { assignee_id: v || null }), true) },
    { label: "Move to", icon: Kanban, options: groups.map((g) => ({ value: g.id, label: g.name })), onPick: (v: string) => run(() => bulkUpdateTasks(plan.id, ids, { group_id: v }), true) },
    { label: "Delete", icon: Trash2, destructive: true, run: () => confirm(`Delete ${ids.length} tasks?`) && run(() => deleteTasks(plan.id, ids), true) },
  ];
  const columns: Column<PlanTask>[] = [
    { id: "title", label: "Task", cell: (t) => <span className={cn("font-medium", t.status === "complete" && "text-muted-foreground line-through")}>{t.is_milestone && <Diamond className="mr-1 inline size-3" />}{t.title}</span>, value: (t) => t.title },
    { id: "status", label: "Status", cell: (t) => <StatusPill status={t.status} />, value: (t) => TASK_STATUSES.find((s) => s.id === t.status)!.label, filter: true },
    { id: "group", label: "Column", cell: (t) => plain(groups.find((g) => g.id === t.group_id)?.name), value: (t) => groups.find((g) => g.id === t.group_id)?.name ?? null, filter: true },
    { id: "assignee", label: "Assignee", cell: (t) => plain(ownerName(staff, t.assignee_id)), value: (t) => ownerName(staff, t.assignee_id), filter: true },
    { id: "priority", label: "Priority", cell: (t) => PRIORITIES.find((p) => p.id === t.priority)!.label, value: (t) => PRIORITIES.findIndex((p) => p.id === t.priority), filter: false },
    { id: "due", label: "Due", cell: (t) => <span className={cn(t.status !== "complete" && isOverdue(t.due_date) && "font-medium text-destructive")}>{t.due_date ? formatDay(t.due_date) : "—"}</span>, value: (t) => t.due_date },
    { id: "labels", label: "Labels", cell: (t) => t.labels.join(", ") || "—", value: (t) => t.labels, filter: true, hidden: true },
  ];

  const Card = ({ t }: { t: PlanTask }) => (
    <article draggable={!readOnly} onDragStart={() => setDragging(t.id)} onDragEnd={() => setDragging(null)}
      className={cn("space-y-1.5 rounded-md border bg-background p-2.5", !readOnly && "cursor-grab", dragging === t.id && "opacity-50")}>
      <div className="flex items-start gap-2">
        {box(t)}
        <button type="button" onClick={() => setOpenId(t.id)} className={cn("min-w-0 flex-1 text-left text-sm font-medium", t.status === "complete" && "text-muted-foreground line-through")}>
          {t.is_milestone && <Diamond className="mr-1 inline size-3" />}{t.title}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {t.status !== "not_started" && t.status !== "complete" && <StatusPill status={t.status} />}
        {t.priority === "high" || t.priority === "urgent" ? <span className={PRIORITIES.find((p) => p.id === t.priority)!.tone}>{t.priority}</span> : null}
        {t.due_date && <span className={cn(t.status !== "complete" && isOverdue(t.due_date) && "font-medium text-destructive")}>{formatDay(t.due_date)}</span>}
        {t.checklist.length > 0 && <span>☑ {t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
        {t.assignee_id && <span className="ml-auto truncate">{ownerName(staff, t.assignee_id)}</span>}
      </div>
    </article>
  );

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-4 px-4 py-6 sm:px-6">
      <Link href="/admin/plans" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Plans</Link>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className={cn("mt-2 size-3 rounded-full", colorDot(plan.color))} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{readOnly ? plan.name : <Editable value={plan.name} align="left" onSave={(v) => run(() => updatePlan(plan.id, { name: v }))} />}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Client: {readOnly ? plan.company?.name ?? "—" : <Editable value={plan.company_id ?? ""} type="select" align="left" options={[{ value: "", label: "None" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
                format={(v) => companies.find((c) => c.id === v)?.name} placeholder="None" onSave={(v) => run(() => updatePlan(plan.id, { company_id: v || null }))} />}</span>
              <span>Owner: {readOnly ? ownerName(staff, plan.owner_id) ?? "—" : <Editable value={plan.owner_id ?? ""} type="select" align="left" options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))]}
                format={(v) => ownerName(staff, v)} placeholder="Unassigned" onSave={(v) => run(() => updatePlan(plan.id, { owner_id: v || null }))} />}</span>
              <span>Due: {readOnly ? (plan.due_date ? formatDay(plan.due_date) : "—") : <Editable value={plan.due_date} type="date" align="left" format={formatDay} placeholder="No date" onSave={(v) => run(() => updatePlan(plan.id, { due_date: v || null }))} />}</span>
              {plan.company && <Link href={`/admin/clients/${plan.company.id}`} className="text-primary hover:underline">Open client</Link>}
            </div>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updatePlan(plan.id, { status: plan.status === "active" ? "archived" : "active" }))}><Archive /> {plan.status === "active" ? "Archive" : "Restore"}</Button>
              <Button size="icon-sm" variant="ghost" aria-label="Delete plan" disabled={pending} onClick={() => confirm(`Delete "${plan.name}" and all its tasks?`) && start(async () => { await deletePlan(plan.id); router.push("/admin/plans"); })}><Trash2 /></Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          <span className="text-sm tabular-nums text-muted-foreground">{done}/{list.length} · {pct}%</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!readOnly ? (
          <form className="flex min-w-60 flex-1 gap-2 sm:max-w-md" onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("title") as HTMLInputElement;
            const title = input.value;
            if (!title.trim()) return;
            input.value = "";
            run(() => addTask(plan.id, { title, group_id: groups[0]?.id ?? null }));
          }}>
            <Input name="title" placeholder="Add a task…" aria-label="New task" />
            <Button type="submit" variant="outline" disabled={pending}><Plus /> Add</Button>
          </form>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide completed</label>
          <ViewSwitcher views={VIEWS} value={view} onChange={(v) => { setView(v); if (!readOnly) void updatePlan(plan.id, { default_view: v }); }} />
        </div>
      </div>
      <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((t) => t.id)))} actions={bulk} />
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}

      {view === "board" ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {[...groups, ...(shown.some((t) => !t.group_id) ? [{ id: "", name: "No column", plan_id: plan.id, position: 999, color: null }] : [])].map((g) => {
            const col = shown.filter((t) => (t.group_id ?? "") === g.id);
            return (
              <section key={g.id || "none"} className="flex w-72 shrink-0 flex-col rounded-xl border bg-card p-2"
                onDragOver={(e) => { if (dragging && !readOnly) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragging) moveTo(dragging, g.id || null); setDragging(null); }}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{readOnly || !g.id ? g.name : <Editable value={g.name} align="left" onSave={(v) => run(() => saveGroup(plan.id, g.id, v))} />}</span>
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                  {!readOnly && g.id && <Button size="icon-xs" variant="ghost" aria-label={`Delete ${g.name}`} onClick={() => confirm(`Delete the "${g.name}" column? Its tasks are kept.`) && run(() => deleteGroup(plan.id, g.id))}><Trash2 /></Button>}
                </div>
                <div className="flex min-h-16 flex-1 flex-col gap-2">{col.map((t) => <Card key={t.id} t={t} />)}</div>
                {!readOnly && g.id && (
                  <form className="mt-2" onSubmit={(e) => { e.preventDefault(); const i = e.currentTarget.elements.namedItem("t") as HTMLInputElement; const v = i.value; if (!v.trim()) return; i.value = ""; run(() => addTask(plan.id, { title: v, group_id: g.id })); }}>
                    <Input name="t" placeholder="+ Add task" className="h-8 border-dashed text-sm" aria-label={`Add task to ${g.name}`} />
                  </form>
                )}
              </section>
            );
          })}
          {!readOnly && (
            <form className="w-60 shrink-0" onSubmit={(e) => { e.preventDefault(); const i = e.currentTarget.elements.namedItem("g") as HTMLInputElement; const v = i.value; if (!v.trim()) return; i.value = ""; run(() => saveGroup(plan.id, null, v)); }}>
              <div className="flex gap-1.5"><Input name="g" placeholder="New column" className="h-9" aria-label="New column" /><Button type="submit" size="icon" variant="outline" aria-label="Add column"><Pencil /></Button></div>
            </form>
          )}
        </div>
      ) : view === "list" ? (
        shown.length === 0 ? <EmptyState message="No tasks yet." /> : (
          <div className="space-y-4">
            {[...groups, { id: "", name: "No column" } as PlanGroup].map((g) => {
              const col = shown.filter((t) => (t.group_id ?? "") === g.id);
              if (!col.length) return null;
              return (
                <div key={g.id || "none"} className="space-y-1">
                  <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.name} · {col.length}</h3>
                  <ul className="divide-y rounded-xl border bg-card">
                    {col.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 p-2.5">
                        {box(t)}
                        <button type="button" disabled={readOnly} aria-label="Toggle complete" onClick={() => complete(t)}
                          className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", t.status === "complete" && "border-emerald-600 bg-emerald-600 text-white")}>{t.status === "complete" && <Check className="size-2.5" />}</button>
                        <button type="button" onClick={() => setOpenId(t.id)} className={cn("min-w-0 flex-1 truncate text-left text-sm", t.status === "complete" && "text-muted-foreground line-through")}>{t.title}</button>
                        {t.status !== "not_started" && t.status !== "complete" && <StatusPill status={t.status} />}
                        <span className="hidden w-28 truncate text-xs text-muted-foreground sm:block">{ownerName(staff, t.assignee_id) ?? ""}</span>
                        <span className={cn("w-16 text-right text-xs text-muted-foreground", t.status !== "complete" && isOverdue(t.due_date) && "font-medium text-destructive")}>{t.due_date ? formatDay(t.due_date) : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )
      ) : view === "grid" ? (
        <DataTable rows={shown} columns={columns} getId={(t) => t.id} selected={selected} onSelect={setSelected} onOpen={(t) => setOpenId(t.id)} />
      ) : (
        <RecordCalendar items={shown} getId={(t) => t.id} getDate={(t) => t.due_date} getTitle={(t) => t.title} onOpen={setOpenId} footer="Tasks placed by due date." />
      )}

      {open && <TaskDrawer key={open.id + open.updated_at} task={open} groups={groups} staff={staff} readOnly={readOnly} onClose={() => setOpenId(null)} />}
    </div>
  );
}
