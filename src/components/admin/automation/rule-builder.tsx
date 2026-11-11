"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveRule, type RuleInput } from "@/lib/admin/actions/automation";
import {
  ACTIONS, FIELDS, MERGE_HINT, OPS, RULE_TRIGGERS, blankAction, needsValue, opsFor, subjectOf, validateRule,
  type ActionType, type Condition, type Rule, type RuleAction, type RuleTrigger,
} from "@/lib/automation/rules";
import { STAGES, STAGE_ORDER } from "@/lib/crm/deals";
import type { Person } from "./rules-panel";

const DELAYS = [{ v: 0, l: "Right away" }, { v: 15, l: "15 minutes later" }, { v: 60, l: "1 hour later" }, { v: 240, l: "4 hours later" },
  { v: 1440, l: "1 day later" }, { v: 4320, l: "3 days later" }, { v: 10080, l: "1 week later" }];

const blank = (): RuleInput => ({
  name: "", description: "", enabled: true, trigger: "lead_created", stage: null, stalled_days: 14, delay_minutes: 0, match: "all", conditions: [], actions: [blankAction("notify_staff")],
});

// Trigger, conditions and actions in one dialog. Changing the trigger drops
// conditions on fields the new trigger doesn't have.
export function RuleBuilder({ rule, templates, people, onClose }: { rule: Rule | null; templates: { id: string; name: string }[]; people: Person[]; onClose: () => void }) {
  const [r, setR] = useState<RuleInput>(() => (rule ? {
    id: rule.id, name: rule.name, description: rule.description ?? "", enabled: rule.enabled, trigger: rule.trigger, stage: rule.stage, stalled_days: rule.stalled_days,
    delay_minutes: rule.delay_minutes, match: rule.match, conditions: rule.conditions, actions: rule.actions,
  } : blank()));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<RuleInput>) => { setR((x) => ({ ...x, ...patch })); setError(null); };
  const fields = FIELDS[subjectOf(r.trigger)];
  const setCond = (i: number, patch: Partial<Condition>) => set({ conditions: r.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setAct = (i: number, a: RuleAction) => set({ actions: r.actions.map((x, j) => (j === i ? a : x)) });
  const move = (i: number, d: -1 | 1) => { const a = [...r.actions]; [a[i], a[i + d]] = [a[i + d], a[i]]; set({ actions: a }); };
  const delays = DELAYS.some((d) => d.v === r.delay_minutes) ? DELAYS : [...DELAYS, { v: r.delay_minutes, l: `${r.delay_minutes} minutes later` }];

  const submit = () => {
    const problem = validateRule(r);
    if (problem) return setError(problem);
    start(async () => {
      const res = await saveRule(r);
      if (res.error) setError(res.error); else onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={rule ? "Edit rule" : "New rule"} description="When something happens, if it matches, do these things." className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5"><Label htmlFor="rule-name">Name</Label><Input id="rule-name" value={r.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="Text new website leads" /></div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={r.enabled} onCheckedChange={(enabled) => set({ enabled })} /> On</label>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">When</legend>
            <Pick label="Trigger" value={r.trigger} options={RULE_TRIGGERS.map((t) => ({ value: t.id, label: t.label }))} onChange={(v) => {
              const trigger = v as RuleTrigger;
              const keep = FIELDS[subjectOf(trigger)].map((f) => f.key);
              set({ trigger, conditions: r.conditions.filter((c) => keep.includes(c.field)) });
            }} />
            {r.trigger === "stage_changed" && (
              <Pick label="Stage" value={r.stage ?? ""} onChange={(v) => set({ stage: v || null })}
                options={[{ value: "", label: "Any stage" }, ...STAGE_ORDER.map((s) => ({ value: s, label: STAGES[s].label }))]} />
            )}
            {r.trigger === "deal_stalled" && (
              <label className="flex items-center gap-2 text-sm">No activity for
                <Input type="number" min={1} max={365} className="w-20" value={r.stalled_days} onChange={(e) => set({ stalled_days: Number(e.target.value) })} /> days
              </label>
            )}
            <Pick label="Delay" value={String(r.delay_minutes)} onChange={(v) => set({ delay_minutes: Number(v) })} options={delays.map((d) => ({ value: String(d.v), label: d.l }))} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 flex w-full items-center gap-2 text-sm font-semibold">
              Only if
              {r.conditions.length > 1 && (
                <Pick label="Match" className="w-auto font-normal" value={r.match} onChange={(v) => set({ match: v as "all" | "any" })}
                  options={[{ value: "all", label: "all of these match" }, { value: "any", label: "any of these match" }]} />
              )}
            </legend>
            {r.conditions.length === 0 && <p className="text-sm text-muted-foreground">Every time. Add a condition to narrow it down.</p>}
            {r.conditions.map((c, i) => {
              const f = fields.find((x) => x.key === c.field) ?? fields[0];
              const ops = opsFor(f.kind);
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.2fr_1fr_1.2fr_auto]">
                  <Pick label="Field" value={c.field} options={fields.map((x) => ({ value: x.key, label: x.label }))} onChange={(v) => {
                    const nf = fields.find((x) => x.key === v)!;
                    setCond(i, { field: nf.key, op: opsFor(nf.kind).includes(c.op) ? c.op : opsFor(nf.kind)[0], value: "" });
                  }} />
                  <Pick label="Comparison" className="max-sm:order-3" value={c.op} onChange={(v) => setCond(i, { op: v as Condition["op"] })}
                    options={ops.map((o) => ({ value: o, label: OPS.find((x) => x.id === o)!.label }))} />
                  {needsValue(c.op) ? (
                    f.kind === "stage" || f.kind === "choice" ? (
                      <Pick label="Value" className="max-sm:order-4" value={c.value} onChange={(v) => setCond(i, { value: v })}
                        options={[{ value: "", label: "Choose…" }, ...(f.kind === "stage" ? STAGE_ORDER.map((s) => ({ value: s as string, label: STAGES[s].label })) : f.choices!.map((v) => ({ value: v, label: v.replace(/_/g, " ") })))]} />
                    ) : (
                      <Input aria-label="Value" className="h-8 max-sm:order-4" type={f.kind === "number" ? "number" : "text"} value={c.value} onChange={(e) => setCond(i, { value: e.target.value })} />
                    )
                  ) : <span className="max-sm:hidden" />}
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" className="max-sm:order-2" onClick={() => set({ conditions: r.conditions.filter((_, j) => j !== i) })}><X /></Button>
                </div>
              );
            })}
            {r.conditions.length < 20 && (
              <Button type="button" variant="outline" size="sm" onClick={() => set({ conditions: [...r.conditions, { field: fields[0].key, op: opsFor(fields[0].kind)[0], value: "" }] })}><Plus /> Add condition</Button>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">Then</legend>
            {r.actions.map((a, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium">{i + 1}</span>
                  <Pick label="Action" value={a.type} onChange={(v) => setAct(i, blankAction(v as ActionType))} options={ACTIONS.map((x) => ({ value: x.type, label: x.label }))} />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === r.actions.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove action" disabled={r.actions.length === 1} onClick={() => set({ actions: r.actions.filter((_, j) => j !== i) })}><X /></Button>
                </div>
                <p className="text-xs text-muted-foreground">{ACTIONS.find((x) => x.type === a.type)?.hint}</p>
                <ActionFields action={a} onChange={(next) => setAct(i, next)} templates={templates} people={people} />
              </div>
            ))}
            {r.actions.length < 10 && <Button type="button" variant="outline" size="sm" onClick={() => set({ actions: [...r.actions, blankAction("create_task")] })}><Plus /> Add action</Button>}
          </fieldset>

          <div className="space-y-1.5"><Label htmlFor="rule-notes">Notes (optional)</Label><Textarea id="rule-notes" rows={2} value={r.description} maxLength={1000} onChange={(e) => set({ description: e.target.value })} /></div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save rule"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActionFields({ action: a, onChange, templates, people }: { action: RuleAction; onChange: (a: RuleAction) => void; templates: { id: string; name: string }[]; people: Person[] }) {
  switch (a.type) {
    case "send_email":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Pick label="Template" value={a.templateId} onChange={(v) => onChange({ ...a, templateId: v })}
            options={[{ value: "", label: "Choose a template…" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]} />
          <Pick label="Send to" value={a.to} onChange={(v) => onChange({ ...a, to: v as typeof a.to })}
            options={[{ value: "contact", label: "The contact / guest / sender" }, { value: "owner", label: "The owner" }, { value: "custom", label: "An email address…" }]} />
          {a.to === "custom" && <Input aria-label="Email address" type="email" className="h-8 sm:col-span-2" placeholder="team@example.com" value={a.email ?? ""} onChange={(e) => onChange({ ...a, email: e.target.value })} />}
          {!templates.length && <p className="text-xs text-muted-foreground sm:col-span-2">Create a template in Communications → Email first.</p>}
        </div>
      );
    case "send_sms":
      return (
        <div className="space-y-2">
          <Pick label="Send to" value={a.to} onChange={(v) => onChange({ ...a, to: v as typeof a.to })}
            options={[{ value: "contact", label: "The contact / guest / sender" }, { value: "custom", label: "A phone number…" }]} />
          {a.to === "custom" && <Input aria-label="Phone number" type="tel" className="h-8" placeholder="(480) 555-0142" value={a.phone ?? ""} onChange={(e) => onChange({ ...a, phone: e.target.value })} />}
          <Textarea aria-label="Message" rows={3} maxLength={1000} value={a.body} onChange={(e) => onChange({ ...a, body: e.target.value })} />
          <p className="text-xs text-muted-foreground">Merge fields: {MERGE_HINT}</p>
        </div>
      );
    case "create_task":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input aria-label="Task" className="h-8" value={a.title} maxLength={300} onChange={(e) => onChange({ ...a, title: e.target.value })} />
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">due in <Input type="number" min={0} max={365} className="h-8 w-16" value={a.dueInDays} onChange={(e) => onChange({ ...a, dueInDays: Number(e.target.value) })} /> days</label>
        </div>
      );
    case "assign_owner":
      return (
        <Pick label="Owner" value={a.userId} onChange={(v) => onChange({ ...a, userId: v })}
          options={[{ value: "", label: "Choose a team member…" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
      );
    case "notify_staff":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Pick label="Who" value={a.userId} onChange={(v) => onChange({ ...a, userId: v })}
            options={[{ value: "owner", label: "The owner" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
          <Input aria-label="Notification title" className="h-8" placeholder="New lead: {{full_name}}" value={a.title} maxLength={200} onChange={(e) => onChange({ ...a, title: e.target.value })} />
        </div>
      );
    case "webhook":
      return <Input aria-label="Webhook URL" type="url" className="h-8" placeholder="https://hooks.example.com/echo" value={a.url} onChange={(e) => onChange({ ...a, url: e.target.value })} />;
  }
}
