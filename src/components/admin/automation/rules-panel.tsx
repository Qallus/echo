"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, CircleSlash, CircleX, Clock, Download, Pencil, Play, Plus, Power, PowerOff, Trash2, Workflow } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { downloadCsv } from "@/components/admin/list-csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableDialog } from "@/components/ui/resizable-dialog";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
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

const when = (x: RuleRun) => (x.status === "queued" ? x.run_at : x.created_at);
const results = (x: RuleRun) => x.results.map((r) => `${ACTIONS.find((a) => a.type === r.type)?.label ?? r.type}${r.detail ? `: ${r.detail}` : ""}`).join(" · ");
const tile = (Icon: typeof Clock, className = "") => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className={`size-4 ${className}`} /></span>;

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
  const router = useRouter();
  // Runs one action per rule in turn; stops at the first error.
  const each = (rows: Rule[], fn: (r: Rule) => Promise<{ ok?: string; error?: string }>) => start(async () => {
    let last: { ok?: string; error?: string } = {};
    for (const r of rows) { last = await fn(r); if (last.error) break; }
    setMsg(last); router.refresh();
  });
  const name = (id: string) => rules.find((r) => r.id === id)?.name ?? "Deleted rule";

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Rules</h2>
          {!readOnly && <Button size="sm" onClick={() => setEditing("new")}><Plus /> New rule</Button>}
        </div>
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        <CollectionView<Rule>
          items={rules} getId={(r) => r.id} title={(r) => r.name} subtitle={summary} noun={["rule", "rules"]} storageKey="admin-automation-rules" defaultView="list"
          empty="No rules yet. Try “When someone books a meeting, text them a confirmation” or “When a deal is won, notify the owner”."
          media={() => tile(Workflow)} badge={(r) => <Badge variant="outline" className={r.enabled ? "text-emerald-600" : "text-muted-foreground"}>{r.enabled ? "On" : "Off"}</Badge>}
          meta={(r) => <>{r.runs} run{r.runs === 1 ? "" : "s"}{r.last_run_at && <> · last <LocalDate iso={r.last_run_at} short /></>}</>}
          searchText={(r) => `${r.name} ${r.description ?? ""} ${summary(r)}`}
          filters={[
            { id: "all", label: "All", test: () => true },
            { id: "on", label: "On", test: (r) => r.enabled },
            { id: "off", label: "Off", test: (r) => !r.enabled },
          ]}
          date={(r) => r.last_run_at}
          columns={[
            { id: "name", label: "Rule", sort: (r) => r.name.toLowerCase(), cell: (r) => <span className="font-medium">{r.name}</span> },
            { id: "when", label: "When", sort: (r) => triggerLabel(r.trigger), cell: (r) => <span className="text-muted-foreground">{triggerLabel(r.trigger)}</span> },
            { id: "actions", label: "Does", cell: (r) => <span className="block max-w-xs truncate text-muted-foreground">{r.actions.map((a) => ACTIONS.find((x) => x.type === a.type)?.label ?? a.type).join(", ")}</span> },
            { id: "status", label: "Status", sort: (r) => (r.enabled ? 1 : 0), cell: (r) => <span className={r.enabled ? "text-emerald-600" : "text-muted-foreground"}>{r.enabled ? "On" : "Off"}</span> },
            { id: "runs", label: "Runs", sort: (r) => r.runs, className: "text-right tabular-nums", cell: (r) => r.runs },
            { id: "last", label: "Last run", sort: (r) => r.last_run_at, cell: (r) => <span className="text-muted-foreground">{r.last_run_at ? <LocalDate iso={r.last_run_at} short /> : "—"}</span> },
          ]}
          actions={[
            ...(readOnly ? [] : [
              { label: "Turn on", icon: Power, show: (rows: Rule[]) => rows.some((r) => !r.enabled), run: (rows: Rule[]) => each(rows.filter((r) => !r.enabled), (r) => setRuleEnabled(r.id, true)) },
              { label: "Turn off", icon: PowerOff, show: (rows: Rule[]) => rows.some((r) => r.enabled), run: (rows: Rule[]) => each(rows.filter((r) => r.enabled), (r) => setRuleEnabled(r.id, false)) },
              { label: "Delete", icon: Trash2, destructive: true, run: (rows: Rule[]) => {
                if (confirm(rows.length === 1 ? `Delete "${rows[0].name}"? Its run history goes too.` : `Delete ${rows.length} rules? Their run history goes too.`)) each(rows, (r) => deleteRule(r.id));
              } },
            ]),
            { label: "Export", icon: Download, run: (rows) => downloadCsv("automation-rules.csv", ["Rule", "Summary", "On", "Runs", "Last run"],
              rows.map((r) => [r.name, summary(r), r.enabled ? "yes" : "no", r.runs, r.last_run_at])) },
          ]}
          previewActions={(r, close) => readOnly ? null : <>
            <Button size="sm" variant="outline" onClick={() => { close(); setTarget(""); setTesting(r); }}><Play /> Run on a record</Button>
            <Button size="sm" onClick={() => { close(); setEditing(r); }}><Pencil /> Edit</Button>
          </>}
          preview={(r) => (
            <div className="space-y-4 text-sm">
              <label className="flex items-center gap-2">
                <Switch checked={r.enabled} disabled={readOnly || pending} aria-label={`${r.name} on`} onCheckedChange={(on) => each([r], () => setRuleEnabled(r.id, on))} />
                {r.enabled ? "On" : "Off"}
              </label>
              {r.description && <p className="text-muted-foreground">{r.description}</p>}
              <p>{summary(r)}</p>
              <p className="text-xs text-muted-foreground">{r.runs} run{r.runs === 1 ? "" : "s"}{r.last_run_at && <> · last <LocalDate iso={r.last_run_at} short /></>}</p>
            </div>
          )}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        <CollectionView<RuleRun>
          items={runs} getId={(x) => x.id} title={(x) => name(x.rule_id)} subtitle={(x) => x.detail ?? STATUS[x.status].label} noun={["run", "runs"]}
          storageKey="admin-automation-runs" defaultView="list" empty="Runs show here as rules fire."
          media={(x) => tile(STATUS[x.status].icon, STATUS[x.status].className)} badge={(x) => <span className={`text-xs ${STATUS[x.status].className}`}>{STATUS[x.status].label}</span>}
          meta={(x) => <LocalDate iso={when(x)} short />}
          searchText={(x) => `${name(x.rule_id)} ${x.detail ?? ""} ${x.status} ${results(x)}`}
          filters={[
            { id: "all", label: "All", test: () => true },
            ...(Object.keys(STATUS) as RuleRun["status"][]).map((st) => ({ id: st, label: STATUS[st].label, test: (x: RuleRun) => x.status === st })),
          ]}
          date={when}
          columns={[
            { id: "rule", label: "Rule", sort: (x) => name(x.rule_id), cell: (x) => <span className="font-medium">{name(x.rule_id)}</span> },
            { id: "status", label: "Status", sort: (x) => x.status, cell: (x) => <span className={STATUS[x.status].className}>{STATUS[x.status].label}</span> },
            { id: "results", label: "Results", cell: (x) => <span className="block max-w-sm truncate text-muted-foreground">{results(x) || x.detail || "—"}</span> },
            { id: "when", label: "When", sort: when, cell: (x) => <span className="text-muted-foreground"><LocalDate iso={when(x)} short /></span> },
          ]}
          actions={[
            { label: "Export", icon: Download, run: (rows) => downloadCsv("automation-runs.csv", ["Rule", "Status", "Detail", "Results", "When"],
              rows.map((x) => [name(x.rule_id), x.status, x.detail, results(x), when(x)])) },
          ]}
          preview={(x) => (
            <div className="space-y-3 text-sm">
              <p className={STATUS[x.status].className}>{STATUS[x.status].label} · <LocalDate iso={when(x)} short /></p>
              {x.detail && <p className="text-muted-foreground">{x.detail}</p>}
              {x.results.length > 0 && (
                <ul className="divide-y rounded-xl border px-3">
                  {x.results.map((r, i) => <li key={i} className={`py-1.5 ${r.ok ? "" : "text-destructive"}`}>{ACTIONS.find((a) => a.type === r.type)?.label}{r.detail ? `: ${r.detail}` : ""}</li>)}
                </ul>
              )}
            </div>
          )}
        />
      </section>

      {editing && <RuleBuilder rule={editing === "new" ? null : editing} templates={templates} people={people} onClose={() => setEditing(null)} />}

      <ResizableDialog open={!!testing} onOpenChange={(o) => !o && setTesting(null)} title="Run on a record" description="Queues this rule for one record. It runs within five minutes, and only if the conditions match.">
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
        </ResizableDialog>
    </div>
  );
}
