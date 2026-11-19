"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Power, PowerOff, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
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
  const many = (rows: Automation[], fn: (a: Automation) => Promise<{ ok?: string; error?: string }>) => start(async () => {
    let last: { ok?: string; error?: string } = {};
    for (const a of rows) { last = await fn(a); if (last.error) break; }
    setMsg(last);
  });
  const tpl = (a: Automation) => templates.find((x) => x.id === a.template_id)?.name ?? "Deleted template";
  const onBadge = (a: Automation) => <Badge variant="outline" className={a.enabled ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>{a.enabled ? "On" : "Off"}</Badge>;
  const remove = (rows: Automation[]) => confirm(rows.length === 1 ? `Delete "${rows[0].name}"?` : `Delete ${rows.length} automations?`) && many(rows, (a) => deleteAutomation(a.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">{cronReady ? "Automations send within about 5 minutes of their trigger (plus any delay)." : "Automations queue up but won't send until the scheduled task is set up in Coolify (see the setup notes)."}</p>
        <span className="ml-auto text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
      </div>
      {!templates.length && <p className="text-sm text-muted-foreground">Create a template first; automations send templates.</p>}
      {automations.length === 0 ? (
        <>
          {!readOnly && <Button variant="outline" disabled={!templates.length} onClick={() => setEditing("new")}><Plus /> New automation</Button>}
          <EmptyState message="No automations yet. Example: when a deal moves to Proposal, send your follow-up template two days later." />
        </>
      ) : (
        <CollectionView<Automation>
          items={automations} getId={(a) => a.id} title={(a) => a.name} noun={["automation", "automations"]} storageKey="admin-automations" defaultView="list"
          subtitle={(a) => describe(a, templates)} media={() => <IconTile icon={Zap} />} badge={onBadge} meta={(a) => `${a.runs} sent`}
          searchText={(a) => `${a.name} ${describe(a, templates)}`}
          filters={[
            { id: "all", label: "All", test: () => true },
            { id: "on", label: "On", test: (a) => a.enabled },
            { id: "off", label: "Off", test: (a) => !a.enabled },
          ]}
          columns={[
            { id: "name", label: "Name", sort: (a) => a.name.toLowerCase(), cell: (a) => <span className="font-medium">{a.name}</span> },
            { id: "when", label: "When", sort: (a) => a.trigger, cell: (a) => muted(TRIGGERS.find((x) => x.id === a.trigger)?.label ?? a.trigger) },
            { id: "template", label: "Sends", sort: (a) => tpl(a), cell: (a) => muted(tpl(a)) },
            { id: "to", label: "To", sort: (a) => a.recipient, cell: (a) => muted(a.recipient === "owner" ? "Deal owner" : "Contact") },
            { id: "delay", label: "Wait", sort: (a) => a.delay_minutes, cell: (a) => muted(delayText(a.delay_minutes)) },
            { id: "runs", label: "Sent", sort: (a) => a.runs, cell: (a) => muted(a.runs) },
            { id: "on", label: "Status", sort: (a) => Number(a.enabled), cell: onBadge },
          ]}
          toolbar={!readOnly && <Button variant="outline" disabled={!templates.length} onClick={() => setEditing("new")}><Plus /> New automation</Button>}
          actions={readOnly ? [] : [
            { label: "Edit", icon: Pencil, single: true, run: ([a]) => setEditing(a) },
            { label: "Turn on", icon: Power, show: (rows) => rows.some((a) => !a.enabled), run: (rows) => many(rows.filter((a) => !a.enabled), (a) => setAutomationEnabled(a.id, true)) },
            { label: "Turn off", icon: PowerOff, show: (rows) => rows.some((a) => a.enabled), run: (rows) => many(rows.filter((a) => a.enabled), (a) => setAutomationEnabled(a.id, false)) },
            { label: "Delete", icon: Trash2, destructive: true, run: remove },
          ]}
          previewActions={(a, close) => !readOnly && (
            <>
              <Button size="sm" variant="outline" onClick={() => { close(); setEditing(a); }}><Pencil /> Edit</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove([a])}><Trash2 /> Delete</Button>
            </>
          )}
          preview={(a) => (
            <div className="space-y-4">
              <p className="rounded-xl border bg-muted/30 p-3 text-sm">{describe(a, templates)}</p>
              <DetailList rows={[["Template", tpl(a)], ["To", a.recipient === "owner" ? "The deal owner" : "The contact"], ["Wait", delayText(a.delay_minutes)], ["Sent so far", a.runs]]} />
              {!readOnly && (
                <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                  <span className="font-medium">Automation is {a.enabled ? "on" : "off"}</span>
                  <Switch checked={a.enabled} aria-label={`${a.name} on`} disabled={pending} onCheckedChange={(on) => run(() => setAutomationEnabled(a.id, on))} />
                </label>
              )}
            </div>
          )}
        />
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
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title={automation ? "Edit automation" : "New automation"} id="automation" defaultWidth={520}>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="au-name">Name</Label><Input id="au-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Proposal follow-up" /></div>
          <div className="space-y-1.5"><Label htmlFor="au-trigger">When</Label>
            <Pick id="au-trigger" label="When" className="h-9" value={form.trigger} onChange={(v) => set({ trigger: v })} options={TRIGGERS.map((t) => ({ value: t.id, label: t.label }))} />
          </div>
          {form.trigger === "stage_changed" && (
            <div className="space-y-1.5"><Label htmlFor="au-stage">Stage</Label>
              <Pick id="au-stage" label="Stage" className="h-9" value={form.stage ?? ""} onChange={(v) => set({ stage: v })}
                options={[{ value: "", label: "Any stage" }, ...STAGE_ORDER.map((s) => ({ value: s, label: STAGES[s].label }))]} />
            </div>
          )}
          {form.trigger === "deal_stalled" && (
            <div className="space-y-1.5"><Label htmlFor="au-days">No activity for (days)</Label><Input id="au-days" type="number" min={1} max={365} value={form.stalled_days} onChange={(e) => set({ stalled_days: Number(e.target.value) })} /></div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="au-tpl">Send template</Label>
              <Pick id="au-tpl" label="Send template" className="h-9" value={form.template_id} onChange={(v) => set({ template_id: v })} options={templates.map((t) => ({ value: t.id, label: t.name }))} />
            </div>
            <div className="space-y-1.5"><Label htmlFor="au-to">To</Label>
              <Pick id="au-to" label="To" className="h-9" value={form.recipient} onChange={(v) => set({ recipient: v as "contact" | "owner" })}
                options={[{ value: "contact", label: "The contact" }, { value: "owner", label: "The deal owner (internal reminder)" }]} />
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="au-delay">Wait</Label>
            <div className="flex gap-2">
              <Input id="au-delay" type="number" min={0} value={form.delay / unit} onChange={(e) => set({ delay: Math.round(Number(e.target.value) * unit) })} className="w-28" />
              <Pick label="Unit" className="h-9" value={String(unit)} onChange={(v) => { const u = Number(v); set({ delay: Math.round((form.delay / unit) * u) }); setUnit(u); }}
                options={[{ value: "1", label: "minutes" }, { value: "60", label: "hours" }, { value: "1440", label: "days" }]} />
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
      </ResponsivePanel>
  );
}
