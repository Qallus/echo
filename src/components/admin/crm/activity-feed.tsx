"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarClock, CheckSquare, Mail, MessageSquare, Phone, Square, StickyNote, Trash2, Users } from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addActivity, deleteActivity, setActivityDone } from "@/lib/admin/actions/crm";
import { ACTIVITY_KINDS, formatDay, isOverdue, type Activity, type ActivityKind, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { ownerName } from "./crm-ui";

const ICONS: Record<ActivityKind, typeof StickyNote> = { note: StickyNote, call: Phone, email: Mail, meeting: Users, task: CheckSquare };

type Target = { company_id?: string; contact_id?: string; deal_id?: string };
type Related = Record<string, { label: string; href: string }>;

// A record's timeline: log a note, call, email, meeting or task, tick tasks
// off. `related` names activities that belong to linked records (a client's
// contacts and deals) so they can link back.
export function ActivityFeed({ activities, staff, target, related = {}, readOnly }: {
  activities: Activity[]; staff: StaffOption[]; target: Target; related?: Related; readOnly?: boolean;
}) {
  const [kind, setKind] = useState<ActivityKind>("note");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const res = await fn(); setError(res.error); });

  const elsewhere = (a: Activity) => {
    const key = [a.deal_id, a.contact_id, a.company_id].find((id) => id && related[id] && !Object.values(target).includes(id));
    return key ? related[key] : null;
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <form className="space-y-2 rounded-xl border p-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addActivity({ kind, body, due, ...target });
            setError(res.error);
            if (res.ok) { setBody(""); setDue(""); }
          });
        }}>
          <div className="flex flex-wrap gap-1">
            {ACTIVITY_KINDS.map((k) => {
              const Icon = ICONS[k.id];
              return (
                <Button key={k.id} type="button" size="sm" variant={kind === k.id ? "secondary" : "ghost"} onClick={() => setKind(k.id)}>
                  <Icon /> {k.label}
                </Button>
              );
            })}
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} aria-label="Activity"
            placeholder={kind === "task" ? "What needs doing?" : kind === "note" ? "Add a note" : `What happened on the ${kind}?`} />
          <div className="flex flex-wrap items-center gap-2">
            {kind === "task" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Due <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-auto" />
              </label>
            )}
            <Button type="submit" size="sm" className="ml-auto" disabled={pending || !body.trim()}>{pending ? "Saving…" : "Add"}</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}

      {activities.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nothing logged yet.</p> : (
        <ol className="space-y-3">
          {activities.map((a) => {
            const Icon = a.kind === "task" ? (a.done_at ? CheckSquare : Square) : ICONS[a.kind] ?? MessageSquare;
            const where = elsewhere(a);
            const dueDay = a.due_at?.slice(0, 10) ?? null;
            return (
              <li key={a.id} className="group flex gap-3">
                {a.kind === "task" && !readOnly ? (
                  <button type="button" aria-label={a.done_at ? "Reopen task" : "Mark task done"} disabled={pending}
                    className="mt-0.5 h-fit text-muted-foreground hover:text-foreground" onClick={() => run(() => setActivityDone(a.id, !a.done_at))}>
                    <Icon className="size-4" />
                  </button>
                ) : <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn("text-sm whitespace-pre-wrap break-words", a.done_at && "text-muted-foreground line-through")}>{a.body}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{ACTIVITY_KINDS.find((k) => k.id === a.kind)?.label}</span>
                    <span>· {ownerName(staff, a.created_by) ?? "—"}</span>
                    <span>· <LocalDate iso={a.created_at} short /></span>
                    {dueDay && !a.done_at && (
                      <span className={cn("inline-flex items-center gap-1", isOverdue(dueDay) && "font-medium text-destructive")}>
                        · <CalendarClock className="size-3" /> Due {formatDay(dueDay)}
                      </span>
                    )}
                    {where && <span>· on <Link href={where.href} className="underline-offset-2 hover:underline">{where.label}</Link></span>}
                  </p>
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="icon-xs" aria-label="Delete" disabled={pending}
                    className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    onClick={() => confirm("Delete this entry?") && run(() => deleteActivity(a.id))}><Trash2 /></Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
