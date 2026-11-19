"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, CalendarClock, Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { createPlan, deletePlan, updatePlan } from "@/lib/admin/actions/plans";
import { CollectionView } from "@/components/collection/collection-view";
import { formatDay, ownerName, type StaffOption } from "@/lib/crm/types";
import { PLAN_TEMPLATES } from "@/lib/plans/templates";
import { PLAN_COLORS, colorDot, type PlanSummary } from "@/lib/plans/types";
import { cn } from "@/lib/utils";
import { StatRow, StatTile } from "@/components/admin/crm/crm-kit";

// Every plan with its progress, in the same layout as every other list:
// list, table, cards and calendar (by due date), checkboxes with the
// quick-action bar, and a click opens the plan's preview.
export function PlansIndex({ plans, companies, staff, readOnly }: { plans: PlanSummary[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const active = plans.filter((p) => p.status === "active");
  const pct = (p: PlanSummary) => (p.tasks ? Math.round((p.done / p.tasks) * 100) : 0);
  const dot = (p: PlanSummary) => <span className={cn("size-3 shrink-0 rounded-full", colorDot(p.color))} />;
  const progress = (p: PlanSummary) => (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct(p)}%` }} /></div>
      <span className="text-xs text-muted-foreground">{p.done}/{p.tasks}</span>
    </div>
  );
  const run = async (fn: () => Promise<{ error?: string }>) => { const r = await fn(); if (r.error) alert(r.error); router.refresh(); };

  return (
    <div className="space-y-5">
      <StatRow>
        <StatTile label="Active plans" value={active.length} />
        <StatTile label="Open tasks" value={active.reduce((n, p) => n + p.tasks - p.done, 0)} />
        <StatTile label="Overdue tasks" value={active.reduce((n, p) => n + p.overdue, 0)} accent />
        <StatTile label="Completed tasks" value={active.reduce((n, p) => n + p.done, 0)} />
      </StatRow>
      <CollectionView<PlanSummary>
        items={plans} getId={(p) => p.id} title={(p) => p.name} noun={["plan", "plans"]} storageKey="admin-plans" defaultView="cards"
        empty="No plans yet. Start one from a template: onboarding, a project, a launch…"
        subtitle={(p) => [p.company?.name, ownerName(staff, p.owner_id)].filter(Boolean).join(" · ") || "No client"}
        media={dot}
        badge={(p) => p.overdue ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{p.overdue} overdue</span> : null}
        meta={(p) => <span className="flex items-center gap-3">{progress(p)}{p.due_date && <span className="flex items-center gap-1"><CalendarClock className="size-3" />{formatDay(p.due_date)}</span>}</span>}
        searchText={(p) => `${p.name} ${p.description ?? ""} ${p.company?.name ?? ""} ${ownerName(staff, p.owner_id) ?? ""}`}
        filters={[
          { id: "active", label: "Active", test: (p) => p.status === "active" },
          { id: "overdue", label: "Overdue", test: (p) => p.status === "active" && p.overdue > 0 },
          { id: "archived", label: "Archived", test: (p) => p.status === "archived" },
          { id: "all", label: "All", test: () => true },
        ]}
        date={(p) => p.due_date ?? p.start_date}
        columns={[
          { id: "name", label: "Plan", sort: (p) => p.name.toLowerCase(), cell: (p) => <span className="flex items-center gap-2 font-medium">{dot(p)}{p.name}</span> },
          { id: "client", label: "Client", sort: (p) => p.company?.name ?? null, cell: (p) => <span className="text-muted-foreground">{p.company?.name ?? "—"}</span> },
          { id: "owner", label: "Owner", sort: (p) => ownerName(staff, p.owner_id) ?? null, cell: (p) => <span className="text-muted-foreground">{ownerName(staff, p.owner_id) ?? "—"}</span> },
          { id: "progress", label: "Progress", sort: (p) => pct(p), cell: progress },
          { id: "overdue", label: "Overdue", sort: (p) => p.overdue, cell: (p) => <span className={p.overdue ? "text-destructive" : "text-muted-foreground"}>{p.overdue || "—"}</span> },
          { id: "due", label: "Due", sort: (p) => p.due_date, cell: (p) => <span className="text-muted-foreground">{p.due_date ? formatDay(p.due_date) : "—"}</span> },
          { id: "updated", label: "Updated", sort: (p) => p.updated_at, cell: (p) => <span className="text-muted-foreground">{formatDay(p.updated_at.slice(0, 10))}</span> },
        ]}
        toolbar={!readOnly && <Button onClick={() => setCreating(true)}><Plus /> New plan</Button>}
        actions={readOnly ? [] : [
          { label: "Open", icon: ExternalLink, single: true, run: ([p]) => router.push(`/admin/plans/${p.id}`) },
          { label: "Archive", icon: Archive, show: (rows) => rows.some((p) => p.status === "active"), run: (rows) => run(async () => { for (const p of rows) { const r = await updatePlan(p.id, { status: "archived" }); if (r.error) return r; } return {}; }) },
          { label: "Restore", icon: ArchiveRestore, show: (rows) => rows.some((p) => p.status === "archived"), run: (rows) => run(async () => { for (const p of rows) { const r = await updatePlan(p.id, { status: "active" }); if (r.error) return r; } return {}; }) },
          { label: "Delete", icon: Trash2, destructive: true, run: (rows) => confirm(`Delete ${rows.length === 1 ? `"${rows[0].name}"` : `${rows.length} plans`} and all their tasks? This can't be undone.`) && run(async () => { for (const p of rows) { const r = await deletePlan(p.id); if (r.error) return r; } return {}; }) },
        ]}
        previewActions={(p) => <Button size="sm" nativeButton={false} render={<Link href={`/admin/plans/${p.id}`} />}><ExternalLink /> Open plan</Button>}
        preview={(p) => (
          <div className="space-y-4 text-sm">
            {p.description && <p className="whitespace-pre-wrap text-muted-foreground">{p.description}</p>}
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct(p)}%` }} /></div>
              <p className="text-xs text-muted-foreground">{p.done} of {p.tasks} tasks done ({pct(p)}%){p.overdue ? `, ${p.overdue} overdue` : ""}</p>
            </div>
            <dl className="divide-y rounded-xl border px-3">
              {[["Client", p.company?.name ?? "None"], ["Owner", ownerName(staff, p.owner_id) ?? "Unassigned"], ["Starts", p.start_date ? formatDay(p.start_date) : "—"],
                ["Due", p.due_date ? formatDay(p.due_date) : "—"], ["Status", p.status === "archived" ? "Archived" : "Active"]].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        )}
      />
      {creating && <NewPlanDialog companies={companies} staff={staff} onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewPlanDialog({ companies, staff, onClose }: { companies: { id: string; name: string }[]; staff: StaffOption[]; onClose: () => void }) {
  const router = useRouter();
  const [template, setTemplate] = useState("onboarding");
  const [f, setF] = useState({ name: "", company_id: "", owner_id: "", start_date: "", color: "sky" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const tpl = PLAN_TEMPLATES.find((t) => t.id === template)!;
  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title="New plan" id="new-plan" defaultWidth={760}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
              className={cn("rounded-xl border p-3 text-left transition-colors", template === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/40")}>
              <span className="flex items-center justify-between gap-2 text-sm font-medium">{t.name}{template === t.id && <Check className="size-4 text-primary" />}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{t.groups.length} columns · {t.tasks.length} tasks</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pl-name">Plan name</Label><Input id="pl-name" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={`${tpl.name}: Acme`} /></div>
          <div className="space-y-1.5"><Label htmlFor="pl-client">Client</Label>
            <Pick id="pl-client" label="Client" value={f.company_id} onChange={(v) => setF({ ...f, company_id: v })} options={[{ value: "", label: "None" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="pl-owner">Owner (tasks start assigned to them)</Label>
            <Pick id="pl-owner" label="Owner" value={f.owner_id} onChange={(v) => setF({ ...f, owner_id: v })} options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))]} />
          </div>
          <div className="space-y-1.5"><Label>Starts</Label><DatePicker value={f.start_date} onChange={(v) => setF({ ...f, start_date: v })} placeholder="Today" /></div>
          <div className="space-y-1.5"><Label>Color</Label>
            <div className="flex gap-2">{PLAN_COLORS.map((c) => <button key={c.id} type="button" aria-label={c.id} onClick={() => setF({ ...f, color: c.id })} className={cn("size-7 rounded-full", c.dot, f.color === c.id && "ring-2 ring-ring ring-offset-2 ring-offset-background")} />)}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Due dates in the template count from the start date.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !f.name.trim()} onClick={() => start(async () => {
            const r = await createPlan({ ...f, template, company_id: f.company_id || null, owner_id: f.owner_id || null });
            if (r.error) setError(r.error); else router.push(`/admin/plans/${r.id}`);
          })}>{pending ? "Creating…" : "Create plan"}</Button>
        </div>
      </ResponsivePanel>
  );
}
