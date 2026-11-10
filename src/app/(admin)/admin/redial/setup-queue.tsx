"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/components/ui/phone-input";
import { assignRedialLine, setRedialSetupStatus } from "@/lib/admin/actions/redial";
import { carrier } from "@/lib/redial/carriers";
import { ROUTES, SCREEN_MODES, type SetupAnswers } from "@/lib/redial/setup";
import { cn } from "@/lib/utils";

export type SetupRow = {
  user_id: string; email: string; full_name: string | null; account_type: string; status: string; step: number; answers: SetupAnswers;
  line_id: string | null; contact_id: string | null; deal_id: string | null; staff_note: string | null; submitted_at: string | null; updated_at: string;
};

const STATUS: Record<string, string> = { submitted: "Ready for a number", needs_info: "Waiting on member", draft: "In progress", active: "Active" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Redial setup requests: what each member answered, and assigning their
// number (which applies the answers to the line).
export function SetupQueue({ rows, manage }: { rows: SetupRow[]; manage: boolean }) {
  if (!rows.length) return <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No setups yet. New members start one after signing up.</p>;
  return <ul className="divide-y rounded-xl border bg-card text-sm">{rows.map((r) => <SetupItem key={r.user_id} row={r} manage={manage} />)}</ul>;
}

function SetupItem({ row: r, manage }: { row: SetupRow; manage: boolean }) {
  const [open, setOpen] = useState(r.status === "submitted");
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState(r.answers.about?.company ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const a = r.answers;
  const facts = [
    ["Mobile", a.about?.phone && formatPhone(a.about.phone)],
    ["Business", a.about?.accountType === "business" ? [a.about.company, a.about.teamSize, a.about.industry].filter(Boolean).join(" · ") : null],
    ["Phone", a.phone?.lineType === "mobile" ? [carrier(a.phone.carrier)?.label, a.phone.device].filter(Boolean).join(" · ") : a.phone?.provider],
    ["Calls reach Redial", ROUTES.find((x) => x.id === a.route?.method)?.label],
    ["Screening", SCREEN_MODES.find((x) => x.id === a.screening?.mode)?.label],
    ["Assistant", a.assistant ? `${a.assistant.name} · ${a.assistant.voice} · ${a.assistant.disclose ? "says it's AI" : "doesn't say it's AI"}` : null],
    ["Ring number", a.after?.forwardTo ? formatPhone(a.after.forwardTo) : a.after ? "In the app" : null],
    ["Plan", a.plan ? (a.plan.priceKey ?? "Free") : null],
    ["Texts", a.review?.updates],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <li className="p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{r.full_name || r.email}</span> <span className="text-muted-foreground">· {r.email}</span>
          <span className="block text-xs text-muted-foreground">{r.account_type === "business" ? "Business" : "Personal"} · step {r.step} of 8 · {r.submitted_at ? `submitted ${when(r.submitted_at)}` : `updated ${when(r.updated_at)}`}</span>
        </span>
        <Badge variant="outline" className={cn(r.status === "submitted" && "border-primary/50", r.status === "active" && "text-emerald-700 dark:text-emerald-400")}>{STATUS[r.status] ?? r.status}</Badge>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
            {facts.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {a.assistant?.about && <p className="rounded-lg bg-muted/50 p-2.5 text-xs whitespace-pre-wrap">{a.assistant.about}</p>}
          <div className="flex flex-wrap gap-3 text-xs">
            {r.contact_id && <Link href={`/admin/contacts/${r.contact_id}`} className="underline">CRM contact</Link>}
            {r.deal_id && <Link href={`/admin/pipeline/${r.deal_id}`} className="underline">Pipeline deal</Link>}
            {r.staff_note && <span className="text-muted-foreground">Your note: {r.staff_note}</span>}
          </div>
          {manage && r.status !== "active" && (
            <div className="space-y-2 rounded-lg border p-3">
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
                e.preventDefault();
                start(async () => setMsg(await assignRedialLine(r.email, number, label)));
              }}>
                <Input type="tel" required aria-label="Twilio number" placeholder="Twilio number, +1 480 555 0100" className="w-56" value={number} onChange={(e) => setNumber(e.target.value)} />
                <Input aria-label="Label" placeholder="Label (optional)" className="w-44" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Button type="submit" size="sm" disabled={pending}>Assign number and apply answers</Button>
              </form>
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Note to the member" placeholder="What's missing? The member sees this." className="min-w-64 flex-1" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" variant="outline" disabled={pending || !note.trim()} onClick={() => start(async () => setMsg(await setRedialSetupStatus(r.user_id, "needs_info", note)))}>Ask for more info</Button>
              </div>
              {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
