"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveStageConfig } from "@/lib/admin/actions/crm-pipeline";
import { STAGES, STAGE_ORDER, newId, type DealStage } from "@/lib/crm/deals";
import { STAGE_GUIDE, defaultStage, type StageConfig, type StoredStage } from "@/lib/crm/guidance";
import { cn } from "@/lib/utils";

const move = <T,>(arr: T[], from: number, to: number) => { const next = [...arr]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next; };
const isAuto = (stage: DealStage, id: string) => Boolean(STAGE_GUIDE[stage].steps.find((s) => s.id === id)?.auto);
const LABEL = "text-xs font-medium tracking-wide text-muted-foreground uppercase";

// Configure stages: the goal, guidance and Next Steps for every stage, shared
// by all opportunities (Channel-Cast's stage-config-dialog).
export function StageConfigDialog({ open, onOpenChange, initial, startStage }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial: StageConfig; startStage: DealStage;
}) {
  const [stage, setStage] = useState<DealStage>(startStage);
  const [draft, setDraft] = useState<Record<DealStage, StoredStage>>(() =>
    Object.fromEntries(STAGE_ORDER.map((s) => [s, initial[s] ?? defaultStage(s)])) as Record<DealStage, StoredStage>);
  const [error, setError] = useState<string>();
  const [saving, start] = useTransition();
  const cur = draft[stage];
  const patch = (next: Partial<StoredStage>) => setDraft({ ...draft, [stage]: { ...cur, ...next } });
  const setStep = (i: number, next: Partial<StoredStage["steps"][number]>) => patch({ steps: cur.steps.map((s, k) => (k === i ? { ...s, ...next } : s)) });

  const save = () => start(async () => {
    const clean = Object.fromEntries(STAGE_ORDER.map((s) => [s, {
      goal: draft[s].goal.trim(),
      actions: draft[s].actions.map((a) => a.trim()).filter(Boolean),
      steps: draft[s].steps.filter((x) => x.label.trim()).map((x) => ({ ...x, label: x.label.trim() })),
    }]));
    const res = await saveStageConfig(clean);
    if (res.error) setError(res.error); else onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent title="Pipeline stages" description="The goal, guidance and Next Steps for each stage. Changes apply to every opportunity."
        className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
        <div className="grid min-h-0 gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="flex gap-1 overflow-x-auto sm:flex-col">
            {STAGE_ORDER.map((s) => (
              <button key={s} type="button" onClick={() => setStage(s)}
                className={cn("flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  stage === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <span className="truncate">{STAGES[s].label}{initial[s] && <span className="ml-1 text-[10px] tracking-wide text-primary uppercase">edited</span>}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{draft[s].steps.length}</span>
              </button>
            ))}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <label className={LABEL} htmlFor="stage-goal">Goal</label>
              <Textarea id="stage-goal" rows={2} value={cur.goal} onChange={(e) => patch({ goal: e.target.value })} placeholder="What this stage is for." />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Guidance for success</span>
                <Button size="sm" variant="ghost" onClick={() => patch({ actions: [...cur.actions, ""] })}><Plus /> Add</Button>
              </div>
              {cur.actions.length === 0 && <p className="text-sm text-muted-foreground">No guidance for this stage.</p>}
              {cur.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input value={a} placeholder="Something the rep should do" onChange={(e) => patch({ actions: cur.actions.map((x, k) => (k === i ? e.target.value : x)) })} />
                  <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => patch({ actions: cur.actions.filter((_, k) => k !== i) })}><Trash2 /></Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Next Steps</span>
                <Button size="sm" variant="ghost" onClick={() => patch({ steps: [...cur.steps, { id: newId("item"), label: "", required: false }] })}><Plus /> Add step</Button>
              </div>
              {cur.steps.length === 0 && <p className="text-sm text-muted-foreground">No steps for this stage yet.</p>}
              {cur.steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1">
                  <Input value={s.label} placeholder="What has to be true to leave this stage" onChange={(e) => setStep(i, { label: e.target.value })} />
                  <button type="button" onClick={() => setStep(i, { required: !s.required })}
                    className={cn("shrink-0 rounded-md border px-2 py-1.5 text-[10px] font-semibold tracking-wide uppercase",
                      s.required ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300" : "text-muted-foreground hover:text-foreground")}>
                    {s.required ? "Required" : "Optional"}
                  </button>
                  <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => patch({ steps: move(cur.steps, i, i - 1) })}><ArrowUp /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === cur.steps.length - 1} onClick={() => patch({ steps: move(cur.steps, i, i + 1) })}><ArrowDown /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Remove" title={isAuto(stage, s.id) ? "Ticks itself from the record; removing it loses that" : "Remove"}
                    onClick={() => patch({ steps: cur.steps.filter((_, k) => k !== i) })}><Trash2 className={cn(isAuto(stage, s.id) && "text-amber-600")} /></Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Required steps block moving forward out of the stage. Some built-in steps tick themselves from the record.</p>
            </div>

            <Button variant="outline" size="sm" onClick={() => patch(defaultStage(stage))}><RotateCcw /> Reset {STAGES[stage].label} to defaults</Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save stages"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
