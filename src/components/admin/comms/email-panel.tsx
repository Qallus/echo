"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Mail, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAudience, deleteTemplate, resubscribe, saveTemplate } from "@/lib/admin/actions/comms";
import { audienceLabel } from "@/lib/comms/audience";
import { STATUSES } from "@/lib/comms/blocks";
import type { Automation, Campaign, SavedAudience, Scheduled, Send, Template, Unsubscribe } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/crm/crm-kit";
import { CollectionView } from "@/components/collection/collection-view";
import { AutomationsPanel } from "./automations-panel";
import { EmailEditor } from "./email/email-editor";
import { History } from "./email/history";
import { ScheduledList } from "./scheduled-list";
import { type Person } from "./email/people-field";
import { cap } from "./email/pick";
import { SendPanel } from "./email/send-panel";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const SUB = ["send", "scheduled", "templates", "audiences", "automations", "history", "unsubscribes"] as const;
const STATUS_TONE: Record<string, string> = { draft: "text-amber-700 dark:text-amber-300", archived: "text-muted-foreground", active: "text-emerald-700 dark:text-emerald-300" };

export function EmailPanel({ templates, sends, campaigns, audiences, unsubscribes, scheduled, people, knownTags, canCustomers, readOnly, automations, cronReady }: {
  templates: Template[]; sends: Send[]; campaigns: Campaign[]; audiences: SavedAudience[]; unsubscribes: Unsubscribe[]; scheduled: Scheduled[];
  people: Person[]; knownTags: string[]; canCustomers: boolean; readOnly: boolean; automations: Automation[]; cronReady: boolean;
}) {
  const [sub, setSub] = useState<(typeof SUB)[number]>(readOnly ? "templates" : "send");
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));

  if (editing) return <EmailEditor template={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />;
  const tabs = SUB.filter((s) => !readOnly || s !== "send");
  const upcoming = scheduled.filter((x) => x.status === "scheduled").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {tabs.map((s) => (
            <button key={s} type="button" onClick={() => setSub(s)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium capitalize", sub === s ? "bg-accent" : "text-muted-foreground hover:text-foreground")}>
              {s}{s === "scheduled" && upcoming > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{upcoming}</span>}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground" role="status">{msg.error ?? msg.ok}</span>
        {!readOnly && <Button variant="outline" onClick={() => setEditing("new")}><Plus /> New template</Button>}
      </div>

      {sub === "send" && <SendPanel templates={templates} people={people} audiences={audiences} knownTags={knownTags} canCustomers={canCustomers} cronReady={cronReady} onEditTemplate={setEditing} />}
      {sub === "scheduled" && <ScheduledList items={scheduled} readOnly={readOnly} empty="Nothing scheduled. On the Send tab, set up an email and press Schedule." />}
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
  const uses = useMemo(() => {
    const m = new Map<string, Automation[]>();
    for (const a of automations) m.set(a.template_id, [...(m.get(a.template_id) ?? []), a]);
    return m;
  }, [automations]);
  const status = (t: Template) => <Badge variant="outline" className={cn("capitalize", STATUS_TONE[t.status])}>{t.status}</Badge>;
  const icon = () => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Mail className="size-4" /></span>;

  if (!templates.length) return <EmptyState message="No templates yet. Build one with New template, or ask Claude to write one." />;
  return (
    <CollectionView<Template>
      items={templates} getId={(t) => t.id} title={(t) => t.name} subtitle={(t) => t.subject || "No subject"} media={icon} badge={status}
      noun={["template", "templates"]} storageKey="admin-email-templates" defaultView="cards"
      searchText={(t) => `${t.name} ${t.subject} ${t.category} ${t.status}`}
      meta={(t) => <>{cap(t.category)} · {t.mode === "html" ? "HTML" : "Blocks"} · {t.sends} sent{t.last_sent_at ? ` · last ${when(t.last_sent_at)}` : ""}</>}
      filters={[
        { id: "current", label: "Draft & active", test: (t) => t.status !== "archived" },
        ...STATUSES.map((st) => ({ id: st, label: cap(st), test: (t: Template) => t.status === st })),
        { id: "all", label: "All", test: () => true },
      ]}
      date={(t) => t.last_sent_at ?? t.updated_at}
      columns={[
        { id: "name", label: "Name", sort: (t) => t.name.toLowerCase(), cell: (t) => <div className="flex items-center gap-2.5">{icon()}<div className="min-w-0"><p className="truncate font-medium">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.subject || "No subject"}</p></div></div> },
        { id: "status", label: "Status", sort: (t) => t.status, cell: status },
        { id: "category", label: "Category", sort: (t) => t.category, cell: (t) => <span className="text-muted-foreground">{cap(t.category)}</span> },
        { id: "mode", label: "Type", sort: (t) => t.mode, cell: (t) => <span className="text-muted-foreground">{t.mode === "html" ? "HTML" : "Blocks"}</span> },
        { id: "uses", label: "Automations", sort: (t) => (uses.get(t.id) ?? []).length, cell: (t) => <span className="text-muted-foreground">{(uses.get(t.id) ?? []).length || "—"}</span> },
        { id: "sends", label: "Sent", sort: (t) => t.sends, cell: (t) => <span className="text-muted-foreground">{t.sends}</span> },
        { id: "updated", label: "Updated", sort: (t) => t.updated_at, cell: (t) => <span className="text-muted-foreground">{when(t.updated_at)}</span> },
      ]}
      actions={readOnly ? [] : [
        { label: "Edit", icon: Pencil, single: true, run: ([t]) => onEdit(t) },
        { label: "Duplicate", icon: Copy, single: true, run: ([t]) => onDuplicate(t) },
        { label: "Delete", icon: Trash2, destructive: true, run: (rows) => rows.forEach(onDelete) },
      ]}
      previewActions={(t, close) => !readOnly && (
        <>
          <Button size="sm" variant="outline" onClick={() => { close(); onEdit(t); }}><Pencil /> Edit</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => onDuplicate(t)}><Copy /> Duplicate</Button>
        </>
      )}
      preview={(t) => {
        const used = uses.get(t.id) ?? [];
        return (
          <div className="space-y-4">
            <dl className="divide-y rounded-xl border px-3 text-sm">
              {[["Subject", t.subject || "No subject"], ["Preview text", t.preheader || "—"], ["Category", cap(t.category)], ["Type", t.mode === "html" ? "HTML" : "Blocks"],
                ["Sent", `${t.sends}${t.last_sent_at ? ` · last ${when(t.last_sent_at)}` : ""}`], ["Automations", used.length ? used.map((a) => `${a.name}${a.enabled ? "" : " (off)"}`).join(", ") : "None"],
                ["Made by", t.created_via === "claude" ? "Claude" : "The team"], ["Updated", when(t.updated_at)]].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
              ))}
            </dl>
            {t.html ? (
              <iframe title={`Preview of ${t.name}`} srcDoc={t.html} sandbox="" className="h-[60dvh] w-full rounded-xl border bg-white" />
            ) : <p className="text-sm text-muted-foreground">Nothing to preview yet. Open it in the editor to build it.</p>}
          </div>
        );
      }}
    />
  );
}

