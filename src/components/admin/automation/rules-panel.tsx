"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleSlash, CircleX, Clock, Pencil, Play, Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { LocalDate } from "@/components/local-date";
import { deleteRule, runRuleOn, setRuleEnabled } from "@/lib/admin/actions/automation";
import { ACTIONS, FIELDS, OPS, subjectOf, triggerLabel, type Rule, type RuleRun, type Subject } from "@/lib/automation/rules";
import { STAGES, type DealStage } from "@/lib/crm/deals";
import { RuleBuilder } from "./rule-builder";

export type Option = { id: string; label: string };
export type Records = Record<Subject, Option[]>;
export type Person = { id: string; name: string };

const STATUS = {
  queued: { icon: Clock, label: "Queued", className: "text-muted-foreground" },
  done: { icon: CircleCheck, label: "Done", className: "text-emerald-600" },
  skipped: { icon: CircleSlash, label: "Skipped", className: "text-muted-foreground" },
  failed: { icon: CircleX, label: "Failed", className: "text-destructive" },
} as const;

const delayText = (m: number) => (!m ? "" : m % 1440 === 0 ? `, after ${m / 1440} day${m === 1440 ? "" : "s"}` : m % 60 === 0 ? `, after ${m / 60} hour${m === 60 ? "" : "s"}` : `, after ${m} min`);

// One plain-English line: "When a deal moves to Proposal, if Value is more
// than 5000: send an email, create a task."
function summary(r: Rule) {
  const fields = FIELDS[subjectOf(r.trigger)];
  const when = `${triggerLabel(r.trigger)}${r.trigger === "stage_changed" && r.stage ? ` (${STAGES[r.stage as DealStage]?.label ?? r.stage})` : ""}${r.trigger === "deal_stalled" ? ` for ${r.stalled_days} days` : ""}`;
  const cond = r.conditions.map((c) => `${fields.find((f) => f.key === c.field)?.label ?? c.field} ${OPS.find((o) => o.id === c.op)?.label ?? c.op}${c.value ? ` ${c.value}` : ""}`).join(r.match === "all" ? " and " : " or ");
  const acts = r.actions.map((a) => ACTIONS.find((x) => x.type === a.type)?.label.toLowerCase() ?? a.type).join(", ");
  return `${when}${cond ? `, if ${cond}` : ""}: ${acts}${delayText(r.delay_minutes)}.`;
}

export function RulesPanel({ rules, runs, templates, people, records, readOnly }: {
  rules: Rule[]; runs: RuleRun[]; templates: { id: string; name: string }[]; people: Person[]; records: Records; readOnly: boolean;
}) {
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [testing, setTesting] = useState<Rule | null>(null);
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));
  const name = (id: string) => rules.find((r) => r.id === id)?.name ?? "Deleted rule";

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Rules</h2>
          {!readOnly && <Button size="sm" onClick={() => setEditing("new")}><Plus /> New rule</Button>}
        </div>
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        {rules.length === 0 ? (
          <EmptyState message="No rules yet. Try “When someone books a meeting, text them a confirmation” or “When a deal is won, notify the owner”." />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 p-4">
                <Workflow className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-sm text-muted-foreground">{summary(r)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.runs} run{r.runs === 1 ? "" : "s"}{r.last_run_at && <> · last <LocalDate iso={r.last_run_at} short /></>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!readOnly && <>
                    <Button variant="ghost" size="icon-sm" aria-label={`Test ${r.name}`} title="Run on a record" onClick={() => { setTarget(""); setTesting(r); }}><Play /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`} disabled={pending}
                      onClick={() => { if (confirm(`Delete "${r.name}"? Its run history goes too.`)) act(() => deleteRule(r.id)); }}><Trash2 /></Button>
                  </>}
                  <Switch checked={r.enabled} disabled={readOnly || pending} aria-label={`${r.name} on`} onCheckedChange={(on) => act(() => setRuleEnabled(r.id, on))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        {runs.length === 0 ? <EmptyState message="Runs show here as rules fire." /> : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {runs.map((run) => {
              const s = STATUS[run.status];
              return (
                <li key={run.id} className="flex flex-wrap items-start gap-3 p-3">
                  <s.icon className={`mt-0.5 size-4 shrink-0 ${s.className}`} aria-label={s.label} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{name(run.rule_id)} <span className="font-normal text-muted-foreground">· {s.label}</span></p>
                    {run.detail && <p className="text-xs text-muted-foreground">{run.detail}</p>}
                    {run.results.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {run.results.map((x, i) => <span key={i} className={x.ok ? "" : "text-destructive"}>{i ? " · " : ""}{ACTIONS.find((a) => a.type === x.type)?.label}{x.detail ? `: ${x.detail}` : ""}</span>)}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground"><LocalDate iso={run.status === "queued" ? run.run_at : run.created_at} short /></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && <RuleBuilder rule={editing === "new" ? null : editing} templates={templates} people={people} onClose={() => setEditing(null)} />}

      <Dialog open={!!testing} onOpenChange={(o) => !o && setTesting(null)}>
        <DialogContent title="Run on a record" description="Queues this rule for one record. It runs within five minutes, and only if the conditions match.">
          {testing && (() => {
            const options = records[subjectOf(testing.trigger)];
            return (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act(async () => { const res = await runRuleOn(testing.id, target); if (res.ok) setTesting(null); return res; }); }}>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-target">{({ deal: "Deal", contact: "Contact", booking: "Booking", message: "Message" } as const)[subjectOf(testing.trigger)]}</Label>
                  <Pick id="rule-target" label={({ deal: "Deal", contact: "Contact", booking: "Booking", message: "Message" } as const)[subjectOf(testing.trigger)]} value={target} required onChange={setTarget}
                    options={[{ value: "", label: "Choose…" }, ...options.map((o) => ({ value: o.id, label: o.label }))]} />
                  {!options.length && <p className="text-xs text-muted-foreground">There are no records of this kind yet.</p>}
                </div>
                <p className="text-xs text-muted-foreground">This really carries out the actions: emails and texts are sent.</p>
                <div className="flex justify-end"><Button type="submit" disabled={pending || !target}>Queue run</Button></div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
