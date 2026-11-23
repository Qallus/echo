"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CirclePause, CirclePlay, ClipboardList, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { LocalDate } from "@/components/local-date";
import { deleteAgentTask, saveAgentTask, setAgentTaskState, type TaskInput } from "@/lib/admin/actions/agent-tasks";
import { REPEATS, TASK_PRESETS, TASK_STATUSES, repeatLabel, type AgentTask, type AgentTaskRun, type Repeat, type TaskStatus } from "@/lib/agents/tasks";
import { cn } from "@/lib/utils";

const TONE: Record<TaskStatus, string> = {
  queued: "bg-sky-500/15 text-sky-700 dark:text-sky-300", claimed: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", failed: "bg-red-500/15 text-red-700 dark:text-red-300", paused: "bg-muted text-muted-foreground",
};
const statusLabel = (s: TaskStatus) => TASK_STATUSES.find((x) => x.id === s)?.label ?? s;
const StatusBadge = ({ s }: { s: TaskStatus }) => <Badge className={cn("border-transparent", TONE[s])}>{statusLabel(s)}</Badge>;
type Msg = { ok?: string; error?: string };

// Work for agents: one-off or repeating tasks they take with agent_task_next
// and report on with agent_task_report (docs/AGENTS.md).
export function TasksView({ tasks, runs, agents, setup }: {
  tasks: AgentTask[]; runs: AgentTaskRun[]; agents: { id: string; name: string }[]; setup: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AgentTask | "new" | null>(null);
  const [msg, setMsg] = useState<Msg>({});
  const [, start] = useTransition();
  const agentName = (id: string | null) => (id ? agents.find((a) => a.id === id)?.name ?? "Removed agent" : "Any agent");
  const act = (fn: () => Promise<Msg>) => start(async () => { const r = await fn(); setMsg(r); if (!r.error) router.refresh(); });

  if (!setup) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Run <code>supabase/migrations/20261124090000_agent_tasks.sql</code> in Supabase to turn on agent tasks.</p>;

  return (
    <div className="space-y-3">
      {(msg.ok || msg.error) && (
        <p className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", msg.error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40")}>
          <span className="flex-1">{msg.error ?? msg.ok}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMsg({})}><X className="size-4" /></button>
        </p>
      )}
      <CollectionView<AgentTask>
        items={tasks} getId={(t) => t.id} title={(t) => t.title} noun={["task", "tasks"]} storageKey="admin-agent-tasks" defaultView="list"
        empty="No tasks yet. Add one: agents pick it up when it's due and report back here."
        media={() => <IconTile icon={ClipboardList} />}
        subtitle={(t) => `${repeatLabel(t)} · ${agentName(t.agent_id)}`}
        badge={(t) => <StatusBadge s={t.status} />}
        meta={(t) => (t.status === "queued" ? <>Next <LocalDate iso={t.next_run_at} short /></> : t.last_run_at ? <>Last <LocalDate iso={t.last_run_at} short /></> : null)}
        searchText={(t) => `${t.title} ${t.instructions} ${t.area ?? ""} ${t.last_result ?? ""} ${agentName(t.agent_id)}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "repeat", label: "Repeating", test: (t) => t.repeat !== "once" },
          ...TASK_STATUSES.map((s) => ({ id: s.id, label: s.label, test: (t: AgentTask) => t.status === s.id })),
        ]}
        columns={[
          { id: "title", label: "Task", cell: (t) => <span className="font-medium">{t.title}</span>, sort: (t) => t.title },
          { id: "status", label: "Status", cell: (t) => <StatusBadge s={t.status} />, sort: (t) => t.status },
          { id: "schedule", label: "Schedule", cell: (t) => repeatLabel(t), sort: (t) => t.repeat },
          { id: "agent", label: "Agent", cell: (t) => muted(agentName(t.agent_id)), sort: (t) => agentName(t.agent_id) },
          { id: "next", label: "Next run", cell: (t) => (t.status === "queued" || t.status === "paused" ? <LocalDate iso={t.next_run_at} short /> : muted(null)), sort: (t) => t.next_run_at },
          { id: "last", label: "Last run", cell: (t) => (t.last_run_at ? <LocalDate iso={t.last_run_at} short /> : muted(null)), sort: (t) => t.last_run_at },
          { id: "runs", label: "Runs", cell: (t) => t.runs, sort: (t) => t.runs, className: "tabular-nums" },
        ]}
        board={{ lanes: TASK_STATUSES.map((s) => ({ id: s.id, label: <StatusBadge s={s.id} /> })), lane: (t) => t.status }}
        date={(t) => t.next_run_at}
        actions={[
          { label: "Run now", icon: Play, run: (rows) => { for (const t of rows) act(() => setAgentTaskState(t.id, "run_now")); } },
          { label: "Pause", icon: CirclePause, show: (rows) => rows.some((t) => t.status !== "paused"), run: (rows) => { for (const t of rows) act(() => setAgentTaskState(t.id, "pause")); } },
          { label: "Resume", icon: CirclePlay, show: (rows) => rows.some((t) => t.status === "paused"), run: (rows) => { for (const t of rows) act(() => setAgentTaskState(t.id, "resume")); } },
          { label: "Delete", icon: Trash2, destructive: true, run: (rows) => { if (confirm(`Delete ${rows.length === 1 ? "this task" : `${rows.length} tasks`} and their reports?`)) for (const t of rows) act(() => deleteAgentTask(t.id)); } },
        ]}
        preview={(t, close) => (
          <div className="space-y-4">
            <DetailList rows={[["Schedule", repeatLabel(t)], ["Agent", agentName(t.agent_id)], ["Area", t.area ?? "—"], ["Runs", t.runs],
              ["Next run", t.status === "queued" || t.status === "paused" ? <LocalDate key="n" iso={t.next_run_at} /> : "—"]]} />
            <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground uppercase">Instructions</p><p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{t.instructions || "—"}</p></div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Reports</p>
              {runs.filter((r) => r.task_id === t.id).length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
              {runs.filter((r) => r.task_id === t.id).slice(0, 10).map((r) => (
                <div key={r.id} className="space-y-1 rounded-lg border p-3 text-sm">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><Badge className={cn("border-transparent", r.ok ? TONE.done : TONE.failed)}>{r.ok ? "Done" : "Failed"}</Badge><LocalDate iso={r.finished_at} /> · {agentName(r.agent_id)}</p>
                  <p className="whitespace-pre-wrap">{r.result}</p>
                  {r.links.length > 0 && <ul className="space-y-0.5 text-xs">{r.links.map((l) => <li key={l}><a href={l} target={l.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="break-all text-primary hover:underline">{l}</a></li>)}</ul>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => act(() => setAgentTaskState(t.id, "run_now"))}><Play /> Run now</Button>
              {t.status === "paused" ? <Button size="sm" variant="outline" onClick={() => act(() => setAgentTaskState(t.id, "resume"))}><CirclePlay /> Resume</Button>
                : <Button size="sm" variant="outline" onClick={() => act(() => setAgentTaskState(t.id, "pause"))}><CirclePause /> Pause</Button>}
              <Button size="sm" variant="outline" onClick={() => { close(); setEditing(t); }}><Pencil /> Edit</Button>
            </div>
          </div>
        )}
        toolbar={<Button onClick={() => setEditing("new")}><Plus /> Add task</Button>}
      />
      {editing && <TaskForm task={editing === "new" ? null : editing} agents={agents} onClose={() => setEditing(null)} onSaved={(r) => { setMsg(r); setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function TaskForm({ task, agents, onClose, onSaved }: { task: AgentTask | null; agents: { id: string; name: string }[]; onClose: () => void; onSaved: (r: Msg) => void }) {
  const [v, setV] = useState<TaskInput>({
    title: task?.title ?? "", instructions: task?.instructions ?? "", agent_id: task?.agent_id ?? null, area: task?.area ?? null,
    repeat: task?.repeat ?? "once", run_time: task?.run_time ?? "08:00",
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await saveAgentTask(task?.id ?? null, { ...v, run_time: v.repeat === "once" && !task?.run_time ? null : v.run_time }); if (r.error) setError(r.error); else onSaved(r); });
  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} id="agent-task" title={task ? "Edit task" : "Add a task"} defaultWidth={600} fullHeight
      description="Agents take a task when it's due, do it with Redial's tools, and report back here. Write it like you'd brief an assistant."
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !v.title.trim()} onClick={save}>{pending ? "Saving…" : task ? "Save" : "Add task"}</Button>
        </div>
      }>
      {!task && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase">Start from</p>
          <div className="flex flex-wrap gap-1.5">
            {TASK_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setV((x) => ({ ...x, title: p.title, instructions: p.instructions, area: p.area, repeat: p.repeat }))}
                className="rounded-full border px-3 py-1 text-xs hover:bg-muted">{p.label}</button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1.5"><Label htmlFor="t-title">Task</Label><Input id="t-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Find 20 HVAC businesses in Chandler, AZ" /></div>
      <div className="space-y-1.5"><Label htmlFor="t-ins">Instructions</Label><Textarea id="t-ins" rows={8} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} placeholder="What to do, which tools to use, what to report back" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="t-rep">How often</Label><Pick id="t-rep" label="How often" value={v.repeat} onChange={(x) => setV({ ...v, repeat: x as Repeat })} options={REPEATS.map((r) => ({ value: r.id, label: r.label }))} /></div>
        <div className="space-y-1.5"><Label htmlFor="t-time">{v.repeat === "once" ? "At (optional)" : "At"}</Label><Input id="t-time" type="time" value={v.run_time ?? ""} onChange={(e) => setV({ ...v, run_time: e.target.value || null })} /></div>
        <div className="space-y-1.5"><Label htmlFor="t-agent">Agent</Label><Pick id="t-agent" label="Agent" value={v.agent_id ?? ""} onChange={(x) => setV({ ...v, agent_id: x || null })} options={[{ value: "", label: "Any agent" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} /></div>
      </div>
      <p className="text-xs text-muted-foreground">Times are in the organization&apos;s time zone (Admin → Settings). Weekly tasks repeat on the weekday of their first run; monthly on the same date. Agents check for due tasks on their own schedule (for example, a Claude scheduled agent every weekday morning).</p>
    </ResponsivePanel>
  );
}
