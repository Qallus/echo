"use client";

import { useState, useTransition } from "react";
import { Check, Diamond, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { deleteTasks, updateTask, type TaskPatch } from "@/lib/admin/actions/plans";
import type { StaffOption } from "@/lib/crm/types";
import { newId } from "@/lib/crm/deals";
import { PRIORITIES, TASK_STATUSES, type PlanGroup, type PlanTask } from "@/lib/plans/types";
import { cn } from "@/lib/utils";
import { SELECT } from "@/components/admin/crm/crm-ui";

// One task in full: everything saves as you change it (text fields on blur).
export function TaskDrawer({ task, groups, staff, readOnly, onClose }: { task: PlanTask; groups: PlanGroup[]; staff: StaffOption[]; readOnly: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [labels, setLabels] = useState(task.labels.join(", "));
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = (patch: TaskPatch) => start(async () => { const r = await updateTask(task.plan_id, task.id, patch); setError(r.error); });
  const doneItems = task.checklist.filter((c) => c.done).length;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg">
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        <div className="space-y-5 pt-6">
          <div className="flex items-start gap-2">
            <button type="button" disabled={readOnly || pending} aria-label={task.status === "complete" ? "Reopen" : "Mark complete"}
              onClick={() => save({ status: task.status === "complete" ? "not_started" : "complete" })}
              className={cn("mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border", task.status === "complete" && "border-emerald-600 bg-emerald-600 text-white")}>
              {task.status === "complete" && <Check className="size-3" />}
            </button>
            <Textarea value={title} disabled={readOnly} rows={1} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== task.title && save({ title })}
              className="min-h-0 resize-none border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent" aria-label="Title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="tk-status">Status</Label>
              <select id="tk-status" className={SELECT} value={task.status} disabled={readOnly} onChange={(e) => save({ status: e.target.value as PlanTask["status"] })}>{TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="tk-pri">Priority</Label>
              <select id="tk-pri" className={SELECT} value={task.priority} disabled={readOnly} onChange={(e) => save({ priority: e.target.value as PlanTask["priority"] })}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="tk-who">Assignee</Label>
              <select id="tk-who" className={SELECT} value={task.assignee_id ?? ""} disabled={readOnly} onChange={(e) => save({ assignee_id: e.target.value || null })}><option value="">Unassigned</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="tk-group">Column</Label>
              <select id="tk-group" className={SELECT} value={task.group_id ?? ""} disabled={readOnly} onChange={(e) => save({ group_id: e.target.value || null })}><option value="">None</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </div>
            <div className="space-y-1.5"><Label>Start</Label><DatePicker value={task.start_date ?? ""} onChange={(v) => save({ start_date: v || null })} /></div>
            <div className="space-y-1.5"><Label>Due</Label><DatePicker value={task.due_date ?? ""} onChange={(v) => save({ due_date: v || null })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={task.is_milestone} disabled={readOnly} onChange={(e) => save({ is_milestone: e.target.checked })} /><Diamond className="size-3.5" /> Milestone</label>

          <div className="space-y-1.5"><Label htmlFor="tk-labels">Labels</Label>
            <Input id="tk-labels" value={labels} disabled={readOnly} onChange={(e) => setLabels(e.target.value)} onBlur={() => save({ labels: labels.split(",").map((l) => l.trim()).filter(Boolean) })} placeholder="Comma separated" />
          </div>
          <div className="space-y-1.5"><Label htmlFor="tk-notes">Notes</Label>
            <Textarea id="tk-notes" rows={5} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (task.notes ?? "") && save({ notes })} />
          </div>

          <div className="space-y-2">
            <Label>Checklist {task.checklist.length > 0 && <span className="font-normal text-muted-foreground">{doneItems}/{task.checklist.length}</span>}</Label>
            <ul className="space-y-1">
              {task.checklist.map((c) => (
                <li key={c.id} className="group flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.done} disabled={readOnly} onChange={() => save({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} />
                  <span className={cn("flex-1", c.done && "text-muted-foreground line-through")}>{c.title}</span>
                  {!readOnly && <button type="button" aria-label="Remove item" className="text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100" onClick={() => save({ checklist: task.checklist.filter((x) => x.id !== c.id) })}><X className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!newItem.trim()) return; save({ checklist: [...task.checklist, { id: newId("chk"), title: newItem.trim(), done: false }] }); setNewItem(""); }}>
                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" className="h-8" />
                <Button type="submit" size="sm" variant="outline"><Plus /></Button>
              </form>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {!readOnly && <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => confirm("Delete this task?") && start(async () => { await deleteTasks(task.plan_id, [task.id]); onClose(); })}><Trash2 /> Delete task</Button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
