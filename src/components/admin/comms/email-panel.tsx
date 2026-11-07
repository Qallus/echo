"use client";

import { useMemo, useState, useTransition } from "react";
import { Bot, Copy, Mail, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAudience, deleteTemplate, resubscribe, saveTemplate } from "@/lib/admin/actions/comms";
import { audienceLabel } from "@/lib/comms/audience";
import { CATEGORIES, STATUSES } from "@/lib/comms/blocks";
import type { Automation, Campaign, SavedAudience, Send, Template, Unsubscribe } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { AutomationsPanel } from "./automations-panel";
import { EmailEditor } from "./email/email-editor";
import { History } from "./email/history";
import { type Person } from "./email/people-field";
import { Pick, cap, optionsOf } from "./email/pick";
import { SendPanel } from "./email/send-panel";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const SUB = ["send", "templates", "audiences", "automations", "history", "unsubscribes"] as const;
const STATUS_TONE: Record<string, string> = { draft: "text-amber-700 dark:text-amber-300", archived: "text-muted-foreground", active: "text-emerald-700 dark:text-emerald-300" };

export function EmailPanel({ templates, sends, campaigns, audiences, unsubscribes, people, knownTags, canCustomers, readOnly, automations, cronReady }: {
  templates: Template[]; sends: Send[]; campaigns: Campaign[]; audiences: SavedAudience[]; unsubscribes: Unsubscribe[];
  people: Person[]; knownTags: string[]; canCustomers: boolean; readOnly: boolean; automations: Automation[]; cronReady: boolean;
}) {
  const [sub, setSub] = useState<(typeof SUB)[number]>(readOnly ? "templates" : "send");
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));

  if (editing) return <EmailEditor template={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />;
  const tabs = SUB.filter((s) => !readOnly || s !== "send");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {tabs.map((s) => (
            <button key={s} type="button" onClick={() => setSub(s)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium capitalize", sub === s ? "bg-accent" : "text-muted-foreground hover:text-foreground")}>{s}</button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground" role="status">{msg.error ?? msg.ok}</span>
        {!readOnly && <Button variant="outline" onClick={() => setEditing("new")}><Plus /> New template</Button>}
      </div>

      {sub === "send" && <SendPanel templates={templates} people={people} audiences={audiences} knownTags={knownTags} canCustomers={canCustomers} onEditTemplate={setEditing} />}
      {sub === "templates" && <TemplateList templates={templates} automations={automations} readOnly={readOnly} pending={pending} onEdit={setEditing}
        onDuplicate={(t) => run(() => saveTemplate(null, { name: `${t.name} (copy)`, subject: t.subject, preheader: t.preheader, category: t.category, status: "draft", mode: t.mode, schema: t.schema, html: t.html }))}
        onDelete={(t) => confirm(`Delete "${t.name}"?${automations.some((a) => a.template_id === t.id) ? " Automations that use it will stop sending." : ""}`) && run(() => deleteTemplate(t.id))} />}
      {sub === "audiences" && (audiences.length === 0 ? <EmptyState message="No saved audiences yet. Build one on the Send tab (Audience) and save it with a name." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {audiences.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="font-medium">{a.name}</p><p className="truncate text-xs text-muted-foreground">{audienceLabel(a.definition)}</p></div>
              {!readOnly && <Button size="icon-sm" variant="ghost" aria-label={`Delete ${a.name}`} disabled={pending} onClick={() => confirm(`Delete the audience "${a.name}"? Nobody is unsubscribed.`) && run(() => deleteAudience(a.id))}><Trash2 /></Button>}
            </li>
          ))}
        </ul>
      ))}
      {sub === "automations" && <AutomationsPanel automations={automations} templates={templates} readOnly={readOnly} cronReady={cronReady} />}
      {sub === "history" && <History sends={sends} campaigns={campaigns} templates={templates} />}
      {sub === "unsubscribes" && (unsubscribes.length === 0 ? <EmptyState message="No one has unsubscribed." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {unsubscribes.map((u) => (
            <li key={u.email} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{u.email}</span>
              {u.reason !== "unsubscribed" && <Badge variant="outline" className="text-destructive" title={u.reason === "bounced" ? "The address doesn't exist or rejected the email permanently" : "They marked an email as spam"}>{u.reason === "bounced" ? "Bounced" : "Marked as spam"}</Badge>}
              <span className="text-xs text-muted-foreground">{when(u.created_at)}</span>
              {!readOnly && <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(u.reason === "bounced" ? `Only do this if you've confirmed ${u.email} works again. Sending to addresses that bounce hurts delivery for everyone.` : `Only do this if ${u.email} asked to receive emails again.`) && run(() => resubscribe(u.email))}>Resubscribe</Button>}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function TemplateList({ templates, automations, readOnly, pending, onEdit, onDuplicate, onDelete }: {
  templates: Template[]; automations: Automation[]; readOnly: boolean; pending: boolean;
  onEdit: (t: Template) => void; onDuplicate: (t: Template) => void; onDelete: (t: Template) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("current");
  const [category, setCategory] = useState("all");
  const shown = templates.filter((t) => (status === "current" ? t.status !== "archived" : status === "all" || t.status === status)
    && (category === "all" || t.category === category) && `${t.name} ${t.subject}`.toLowerCase().includes(q.trim().toLowerCase()));
  const uses = useMemo(() => {
    const m = new Map<string, Automation[]>();
    for (const a of automations) m.set(a.template_id, [...(m.get(a.template_id) ?? []), a]);
    return m;
  }, [automations]);

  if (!templates.length) return <EmptyState message="No templates yet. Build one with New template, or ask Claude to write one." />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64 max-w-full">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates" className="h-8 w-full rounded-lg border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring" />
        </div>
        <Pick label="Status" className="w-36" value={status} onChange={setStatus} options={[{ value: "current", label: "Draft & active" }, ...optionsOf(STATUSES), { value: "all", label: "All" }]} />
        <Pick label="Category" className="w-40" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...optionsOf(CATEGORIES)]} />
      </div>
      {shown.length === 0 ? <EmptyState message="No templates match." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => {
            const used = uses.get(t.id) ?? [];
            return (
              <div key={t.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.subject || "No subject"}</p></div>
                  <Badge variant="outline" className={cn("capitalize", STATUS_TONE[t.status])}>{t.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded border px-1.5 py-px">{cap(t.category)}</span>
                  <span className="rounded border px-1.5 py-px">{t.mode === "html" ? "HTML" : "Blocks"}</span>
                  {t.created_via === "claude" && <span className="flex items-center gap-1 rounded border px-1.5 py-px"><Bot className="size-3" />By Claude</span>}
                  {used.length > 0 && <span className="rounded border px-1.5 py-px" title={used.map((a) => `${a.name}${a.enabled ? "" : " (off)"}`).join(", ")}>Used by {used.length} automation{used.length > 1 ? "s" : ""}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{t.sends} sent{t.last_sent_at ? ` · last ${when(t.last_sent_at)}` : ""}</p>
                {!readOnly && (
                  <div className="mt-auto flex gap-1 pt-1">
                    <Button size="sm" variant="outline" onClick={() => onEdit(t)}><Pencil /> Edit</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => onDuplicate(t)} title="Copies it as a draft"><Copy /> Duplicate</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.name}`} className="ml-auto" disabled={pending} onClick={() => onDelete(t)}><Trash2 /></Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

