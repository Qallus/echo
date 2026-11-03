"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { deleteAutomation, saveAutomation, setAutomationEnabled } from "@/lib/admin/actions/comms";
import type { Automation, Template } from "@/lib/comms/data";
import { STAGES, STAGE_ORDER } from "@/lib/crm/deals";
import { EmptyState } from "@/components/admin/crm/crm-kit";

const TRIGGERS: { id: string; label: string }[] = [
  { id: "lead_created", label: "A lead is added" }, { id: "added_to_pipeline", label: "A deal is added to the pipeline" },
  { id: "stage_changed", label: "A deal moves to a stage" }, { id: "closed_won", label: "A deal is won" }, { id: "closed_lost", label: "A deal is lost" },
  { id: "next_step_overdue", label: "A deal's next step is overdue" }, { id: "deal_stalled", label: "A deal goes quiet" },
];
const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30";
const delayText = (m: number) => (!m ? "right away" : m % 1440 === 0 ? `after ${m / 1440} day${m === 1440 ? "" : "s"}` : m % 60 === 0 ? `after ${m / 60} hour${m === 60 ? "" : "s"}` : `after ${m} min`);

export function describe(a: Automation, templates: Template[]) {
  const t = TRIGGERS.find((x) => x.id === a.trigger)?.label ?? a.trigger;
  const stage = a.trigger === "stage_changed" ? (a.stage ? ` (${STAGES[a.stage as keyof typeof STAGES]?.label})` : " (any stage)") : "";
  const quiet = a.trigger === "deal_stalled" ? ` for ${a.stalled_days} days` : "";
  return `${t}${stage}${quiet} → send "${templates.find((x) => x.id === a.template_id)?.name ?? "a template"}" to the ${a.recipient === "owner" ? "deal owner" : "contact"} ${delayText(a.delay_minutes)}`;
}

// "When <something happens>, send <template> to <contact or owner>."
export function AutomationsPanel({ automations, templates, readOnly, cronReady }: { automations: Automation[]; templates: Template[]; readOnly: boolean; cronReady: boolean }) {
  const [editing, setEditing] = useState<Automation | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">{cronReady ? "Automations send within about 5 minutes of their trigger (plus any delay)." : "Automations queue up but won't send until the scheduled task is set up in Coolify (see the setup notes)."}</p>
        <span className="ml-auto text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
        {!readOnly && <Button variant="outline" disabled={!templates.length} onClick={() => setEditing("new")}><Plus /> New automation</Button>}
      </div>
      {!templates.length && <p className="text-sm text-muted-foreground">Create a template first; automations send templates.</p>}
      {automations.length === 0 ? <EmptyState message="No automations yet. Example: when a deal moves to Proposal, send your follow-up template two days later." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {automations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
              <Zap className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{describe(a, templates)} · {a.runs} sent</p>
              </div>
              {!readOnly && <>
                <Switch checked={a.enabled} aria-label={`${a.name} on`} disabled={pending} onCheckedChange={(on) => run(() => setAutomationEnabled(a.id, on))} />
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${a.name}`} disabled={pending} onClick={() => confirm(`Delete "${a.name}"?`) && run(() => deleteAutomation(a.id))}><Trash2 /></Button>
              </>}
            </li>
          ))}
        </ul>
      )}
      {editing && <AutomationDialog automation={editing === "new" ? undefined : editing} templates={templates} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AutomationDialog({ automation, templates, onClose }: { automation?: Automation; templates: Template[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: automation?.name ?? "", trigger: automation?.trigger ?? "stage_changed", stage: automation?.stage ?? "proposal",
    stalled_days: automation?.stalled_days ?? 14, template_id: automation?.template_id ?? templates[0]?.id ?? "",
    recipient: automation?.recipient ?? "contact", delay: automation ? automation.delay_minutes : 0, enabled: automation?.enabled ?? true,
  });
  const [unit, setUnit] = useState(form.delay && form.delay % 1440 === 0 ? 1440 : form.delay && form.delay % 60 === 0 ? 60 : 1);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={automation ? "Edit automation" : "New automation"} className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="au-name">Name</Label><Input id="au-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Proposal follow-up" /></div>
          <div className="space-y-1.5"><Label htmlFor="au-trigger">When</Label>
            <select id="au-trigger" value={form.trigger} onChange={(e) => set({ trigger: e.target.value })} className={SELECT}>{TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          </div>
          {form.trigger === "stage_changed" && (
            <div className="space-y-1.5"><Label htmlFor="au-stage">Stage</Label>
              <select id="au-stage" value={form.stage ?? ""} onChange={(e) => set({ stage: e.target.value })} className={SELECT}>
                <option value="">Any stage</option>{STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGES[s].label}</option>)}
              </select>
            </div>
          )}
          {form.trigger === "deal_stalled" && (
            <div className="space-y-1.5"><Label htmlFor="au-days">No activity for (days)</Label><Input id="au-days" type="number" min={1} max={365} value={form.stalled_days} onChange={(e) => set({ stalled_days: Number(e.target.value) })} /></div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="au-tpl">Send template</Label>
              <select id="au-tpl" value={form.template_id} onChange={(e) => set({ template_id: e.target.value })} className={SELECT}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="au-to">To</Label>
              <select id="au-to" value={form.recipient} onChange={(e) => set({ recipient: e.target.value as "contact" | "owner" })} className={SELECT}>
                <option value="contact">The contact</option><option value="owner">The deal owner (internal reminder)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="au-delay">Wait</Label>
            <div className="flex gap-2">
              <Input id="au-delay" type="number" min={0} value={form.delay / unit} onChange={(e) => set({ delay: Math.round(Number(e.target.value) * unit) })} className="w-28" />
              <select value={unit} onChange={(e) => { const u = Number(e.target.value); set({ delay: Math.round((form.delay / unit) * u) }); setUnit(u); }} className={SELECT} aria-label="Unit">
                <option value={1}>minutes</option><option value={60}>hours</option><option value={1440}>days</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} /> On</label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const res = await saveAutomation(automation?.id ?? null, { ...form, delay_minutes: form.delay });
            if (res.error) setError(res.error); else onClose();
          })}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
