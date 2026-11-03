"use client";

import { useState, useTransition } from "react";
import { Copy, Mail, Pencil, Plus, Send as SendIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteTemplate, resubscribe, saveTemplate } from "@/lib/admin/actions/comms";
import type { Automation, Send, Template } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { ComposeDialog, type Person } from "./compose-dialog";
import { AutomationsPanel } from "./automations-panel";
import { EmailEditor } from "./email-editor";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const SUB = ["templates", "automations", "history", "unsubscribes"] as const;

export function EmailPanel({ templates, sends, unsubscribes, people, readOnly, automations, cronReady }: {
  templates: Template[]; sends: Send[]; unsubscribes: { email: string; created_at: string }[]; people: Person[]; readOnly: boolean;
  automations: Automation[]; cronReady: boolean;
}) {
  const [sub, setSub] = useState<(typeof SUB)[number]>("templates");
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [composing, setComposing] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));
  const names = new Map(templates.map((t) => [t.id, t.name]));

  if (editing) return <EmailEditor template={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {SUB.map((s) => (
            <button key={s} type="button" onClick={() => setSub(s)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium capitalize", sub === s ? "bg-accent" : "text-muted-foreground hover:text-foreground")}>{s}</button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
        {!readOnly && <Button variant="outline" onClick={() => setEditing("new")}><Plus /> New template</Button>}
        {!readOnly && <Button onClick={() => setComposing(true)}><SendIcon /> New email</Button>}
      </div>

      {sub === "templates" && (templates.length === 0 ? <EmptyState message="No templates yet. Build one with New template." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.subject || "No subject"}</p></div>
                <Badge variant="outline" className="capitalize">{t.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t.sends} sent{t.last_sent_at ? ` · last ${when(t.last_sent_at)}` : ""}</p>
              {!readOnly && (
                <div className="mt-auto flex gap-1 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}><Pencil /> Edit</Button>
                  <Button size="sm" variant="ghost" disabled={pending || !t.schema} onClick={() => run(() => saveTemplate(null, { name: `${t.name} (copy)`, subject: t.subject, preheader: t.preheader ?? "", category: t.category, schema: t.schema! }))}><Copy /> Duplicate</Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`} className="ml-auto" disabled={pending}
                    onClick={() => confirm(`Delete "${t.name}"?`) && run(() => deleteTemplate(t.id))}><Trash2 /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {sub === "automations" && <AutomationsPanel automations={automations} templates={templates} readOnly={readOnly} cronReady={cronReady} />}

      {sub === "history" && (sends.length === 0 ? <EmptyState message="Nothing sent yet." /> : (
        <div className="rounded-xl border bg-card px-2">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>To</TableHead><TableHead>Subject</TableHead><TableHead>Template</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {sends.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{when(s.created_at)}</TableCell>
                  <TableCell>{s.to_email}</TableCell>
                  <TableCell className="max-w-64 truncate">{s.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{s.template_id ? names.get(s.template_id) ?? "Deleted" : "Message"}</TableCell>
                  <TableCell title={s.error ?? undefined}>
                    <Badge variant="outline" className={cn(s.status === "failed" && "text-destructive", s.status === "skipped" && "text-muted-foreground")}>{s.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {sub === "unsubscribes" && (unsubscribes.length === 0 ? <EmptyState message="No one has unsubscribed." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {unsubscribes.map((u) => (
            <li key={u.email} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{u.email}</span>
              <span className="text-xs text-muted-foreground">{when(u.created_at)}</span>
              {!readOnly && <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(`Only do this if ${u.email} asked to receive emails again.`) && run(() => resubscribe(u.email))}>Resubscribe</Button>}
            </li>
          ))}
        </ul>
      ))}

      {composing && <ComposeDialog people={people} onClose={() => setComposing(false)} />}
    </div>
  );
}
