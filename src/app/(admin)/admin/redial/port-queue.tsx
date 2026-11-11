"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { PORT_STATUS } from "@/components/redial/port-form";
import { revealPortDetails, setPortStatus, type PortStatus } from "@/lib/admin/actions/redial";
import { cn } from "@/lib/utils";

export type PortQueueRow = {
  id: string; email: string; full_name: string | null; number: string; number_type: string; carrier: string; account_name: string;
  account_hint: string | null; has_pin: boolean; service_street: string; service_city: string; service_region: string; service_postal_code: string;
  authorized_name: string; authorized_at: string; wanted_date: string | null; note: string | null; status: string; foc_date: string | null;
  staff_note: string | null; contact_id: string | null; created_at: string;
};

const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const MOVES: PortStatus[] = ["submitted", "in_review", "needs_info", "with_carrier", "scheduled", "completed", "rejected"];

// Number port requests: the bill details to submit the port with the
// carrier (Twilio Console → Phone Numbers → Port & Host), and status updates
// the member sees on their Bring your number page.
export function PortQueue({ rows, manage }: { rows: PortQueueRow[]; manage: boolean }) {
  if (!rows.length) return <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No port requests yet.</p>;
  return <ul className="divide-y rounded-xl border bg-card text-sm">{rows.map((r) => <PortItem key={r.id} row={r} manage={manage} />)}</ul>;
}

function PortItem({ row: r, manage }: { row: PortQueueRow; manage: boolean }) {
  const open0 = ["submitted", "in_review", "needs_info"].includes(r.status);
  const [open, setOpen] = useState(r.status === "submitted");
  const [status, setStatus] = useState<string>(MOVES.includes(r.status as PortStatus) ? r.status : "in_review");
  const [foc, setFoc] = useState(r.foc_date ?? "");
  const [note, setNote] = useState(r.staff_note ?? "");
  const [secret, setSecret] = useState<{ accountNumber?: string; pin?: string | null } | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const facts: [string, string][] = [
    ["Member", `${r.full_name ? `${r.full_name} · ` : ""}${r.email}`],
    ["Type", r.number_type],
    ["Carrier", r.carrier],
    ["Account", `${r.account_name} · ending ${r.account_hint ?? "?"}${r.has_pin ? " · has PIN" : " · no PIN"}`],
    ["Service address", `${r.service_street}, ${r.service_city}, ${r.service_region} ${r.service_postal_code}`],
    ["Authorized", `${r.authorized_name} · ${when(r.authorized_at)}`],
    ...(r.wanted_date ? [["Wants", r.wanted_date] as [string, string]] : []),
    ...(r.note ? [["Note", r.note] as [string, string]] : []),
  ];

  return (
    <li className="p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{pretty(r.number)}</span> <span className="text-muted-foreground">· {r.carrier} · {r.full_name || r.email}</span>
          <span className="block text-xs text-muted-foreground">Requested {when(r.created_at)}{r.foc_date ? ` · transfer ${r.foc_date}` : ""}</span>
        </span>
        <Badge variant="outline" className={cn(open0 && "border-primary/50")}>{PORT_STATUS[r.status] ?? r.status}</Badge>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr]">
            {facts.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {r.contact_id && <Link href={`/admin/contacts/${r.contact_id}`} className="text-xs underline">Open in the CRM</Link>}
          {manage && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {secret ? (
                  <p className="rounded-lg border px-3 py-2 font-mono text-xs">Account {secret.accountNumber}{secret.pin ? ` · PIN ${secret.pin}` : ""}</p>
                ) : (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const x = await revealPortDetails(r.id); if (x.error) setMsg({ error: x.error }); else setSecret(x); })}><Eye /> Show account number and PIN</Button>
                )}
                <span className="text-xs text-muted-foreground">Each view is logged.</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[12rem_10rem_1fr_auto]">
                <Pick label="Status" value={status} onChange={setStatus} options={MOVES.map((s) => ({ value: s, label: PORT_STATUS[s] }))} />
                <Input type="date" aria-label="Transfer date (FOC)" value={foc} onChange={(e) => setFoc(e.target.value)} />
                <Input aria-label="Note the member sees" placeholder="Note the member sees (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <Button disabled={pending} onClick={() => start(async () => setMsg(await setPortStatus(r.id, status as PortStatus, foc, note)))}>Update</Button>
              </div>
            </>
          )}
          {(msg.ok || msg.error) && <p className={msg.error ? "text-destructive" : "text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        </div>
      )}
    </li>
  );
}
