"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarClock, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { createPlan } from "@/lib/admin/actions/plans";
import { formatDay, ownerName, type StaffOption } from "@/lib/crm/types";
import { PLAN_TEMPLATES } from "@/lib/plans/templates";
import { PLAN_COLORS, colorDot, type PlanSummary } from "@/lib/plans/types";
import { cn } from "@/lib/utils";
import { EmptyState, SearchBox, StatRow, StatTile } from "@/components/admin/crm/crm-kit";

// Every plan with its progress. New plans start from a template.
export function PlansIndex({ plans, companies, staff, readOnly }: { plans: PlanSummary[]; companies: { id: string; name: string }[]; staff: StaffOption[]; readOnly: boolean }) {
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => p.status === status && (!q || `${p.name} ${p.company?.name ?? ""}`.toLowerCase().includes(q)));
  }, [plans, status, search]);
  const active = plans.filter((p) => p.status === "active");

  return (
    <div className="space-y-5">
      <StatRow>
        <StatTile label="Active plans" value={active.length} />
        <StatTile label="Open tasks" value={active.reduce((n, p) => n + p.tasks - p.done, 0)} />
        <StatTile label="Overdue tasks" value={active.reduce((n, p) => n + p.overdue, 0)} accent />
        <StatTile label="Completed tasks" value={active.reduce((n, p) => n + p.done, 0)} />
      </StatRow>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search plans…" />
          <div className="flex gap-1 rounded-lg border bg-card p-1">
            {(["active", "archived"] as const).map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-md px-3 py-1 text-sm capitalize", status === s ? "bg-accent font-medium" : "text-muted-foreground")}>{s}</button>)}
          </div>
        </div>
        {!readOnly && <Button onClick={() => setCreating(true)}><Plus /> New plan</Button>}
      </div>
      {shown.length === 0 ? <EmptyState message={plans.length ? "No plans here." : "No plans yet. Start one from a template: onboarding, a project, a launch…"} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const pct = p.tasks ? Math.round((p.done / p.tasks) * 100) : 0;
            return (
              <Link key={p.id} href={`/admin/plans/${p.id}`} className="space-y-3 rounded-xl border bg-card p-4 hover:border-primary/40">
                <div className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", colorDot(p.color))} /><span className="min-w-0 flex-1 truncate font-medium">{p.name}</span></div>
                <p className="truncate text-xs text-muted-foreground">{[p.company?.name, ownerName(staff, p.owner_id)].filter(Boolean).join(" · ") || "No client"}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.done}/{p.tasks} done{p.overdue ? <span className="text-destructive"> · {p.overdue} overdue</span> : null}</span>
                  {p.due_date && <span className="flex items-center gap-1"><CalendarClock className="size-3" />{formatDay(p.due_date)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="New plan" className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto">
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
      </DialogContent>
    </Dialog>
  );
}
