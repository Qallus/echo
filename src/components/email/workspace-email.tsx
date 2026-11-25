"use client";

import { useState, useTransition } from "react";
import { FileText, Mail, Plus, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { CollectionView } from "@/components/collection/collection-view";
import { IconTile, muted } from "@/components/collection/kit";
import { deleteEmailTemplate, saveEmailTemplate, sendWorkspaceEmail } from "@/lib/email/workspace-actions";

// Emails: a sent log in the shared list layout, a compose sheet (contacts or
// any address, a saved template to start from) and saved templates.

export type SentEmail = { id: string; to_email: string; subject: string; body: string; status: "sent" | "failed"; error: string | null; created_at: string };
export type EmailTemplate = { id: string; name: string; subject: string; body: string; updated_at: string };
export type EmailPerson = { id: string; name: string; email: string };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function WorkspaceEmail({ sent, templates, people, workspaceName }: { sent: SentEmail[]; templates: EmailTemplate[]; people: EmailPerson[]; workspaceName: string }) {
  const [compose, setCompose] = useState<{ to: string[]; subject: string; body: string } | null>(null);
  const [editing, setEditing] = useState<{ id?: string; name: string; subject: string; body: string } | null>(null);
  const [view, setView] = useState<"sent" | "templates">("sent");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const byEmail = new Map(people.map((p) => [p.email.toLowerCase(), p]));

  const toOptions = [
    ...people.map((p) => ({ value: p.email.toLowerCase(), label: p.name, hint: p.email })),
    ...(compose?.to ?? []).filter((e) => !byEmail.has(e)).map((e) => ({ value: e, label: e })),
  ];
  const typed = (t: string) => {
    const e = t.trim().toLowerCase();
    return EMAIL.test(e) && !byEmail.has(e) ? { value: e, label: e, hint: "Email this address" } : null;
  };
  const send = () => compose && start(async () => {
    const contactIds = Object.fromEntries(compose.to.map((e) => [e, byEmail.get(e)?.id]).filter(([, id]) => id)) as Record<string, string>;
    const res = await sendWorkspaceEmail({ ...compose, contactIds });
    setMsg(res);
    if (res.sent && !res.error) setCompose(null);
  });
  const saveTemplate = () => editing && start(async () => {
    const res = await saveEmailTemplate(editing);
    setMsg(res);
    if (!res.error) setEditing(null);
  });

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-1 border-b">
        {(["sent", "templates"] as const).map((v) => (
          <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === v ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {v === "sent" ? `Sent (${sent.length})` : `Templates (${templates.length})`}
          </button>
        ))}
      </div>
      {msg.ok && !compose && <p className="text-sm text-muted-foreground">{msg.ok}</p>}

      {view === "sent" ? (
        <CollectionView<SentEmail>
          items={sent} getId={(e) => e.id} title={(e) => e.subject} noun={["email", "emails"]} storageKey="workspace-emails" defaultView="list"
          subtitle={(e) => `To ${byEmail.get(e.to_email)?.name ?? e.to_email}`}
          media={() => <IconTile icon={Mail} />}
          badge={(e) => (e.status === "failed" ? <Badge variant="outline" className="text-destructive">Not sent</Badge> : null)}
          meta={(e) => when(e.created_at)}
          searchText={(e) => `${e.subject} ${e.to_email} ${e.body}`}
          filters={[
            { id: "all", label: "All", test: () => true },
            { id: "failed", label: "Not sent", test: (e) => e.status === "failed" },
          ]}
          date={(e) => e.created_at}
          columns={[
            { id: "subject", label: "Subject", sort: (e) => e.subject.toLowerCase(), cell: (e) => <span className="font-medium">{e.subject}</span> },
            { id: "to", label: "To", sort: (e) => e.to_email, cell: (e) => muted(byEmail.get(e.to_email)?.name ?? e.to_email) },
            { id: "status", label: "Status", cell: (e) => (e.status === "failed" ? <span className="text-destructive">{e.error ?? "Not sent"}</span> : muted("Sent")) },
            { id: "when", label: "Sent", sort: (e) => e.created_at, cell: (e) => muted(when(e.created_at)) },
          ]}
          preview={(e) => (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">To {e.to_email} · {when(e.created_at)}</p>
              <p className="font-medium">{e.subject}</p>
              <p className="whitespace-pre-wrap break-words">{e.body}</p>
            </div>
          )}
          previewActions={(e) => <Button size="sm" variant="outline" onClick={() => { setMsg({}); setCompose({ to: [e.to_email], subject: e.subject.startsWith("Re:") ? e.subject : `Re: ${e.subject}`, body: "" }); }}>Write again</Button>}
          empty="No emails sent yet."
          toolbar={<Button onClick={() => { setMsg({}); setCompose({ to: [], subject: "", body: "" }); }}><Plus /> New email</Button>}
        />
      ) : (
        <CollectionView<EmailTemplate>
          items={templates} getId={(t) => t.id} title={(t) => t.name} noun={["template", "templates"]} storageKey="workspace-email-templates" defaultView="list"
          subtitle={(t) => t.subject || "No subject"}
          media={() => <IconTile icon={FileText} />}
          meta={(t) => when(t.updated_at)}
          searchText={(t) => `${t.name} ${t.subject} ${t.body}`}
          columns={[
            { id: "name", label: "Name", sort: (t) => t.name.toLowerCase(), cell: (t) => <span className="font-medium">{t.name}</span> },
            { id: "subject", label: "Subject", cell: (t) => muted(t.subject) },
            { id: "updated", label: "Updated", sort: (t) => t.updated_at, cell: (t) => muted(when(t.updated_at)) },
          ]}
          actions={[
            { label: "Use", icon: Send, single: true, run: ([t]) => { setMsg({}); setCompose({ to: [], subject: t.subject, body: t.body }); } },
            { label: "Delete", icon: Trash2, destructive: true, run: (rows) => start(async () => { for (const t of rows) setMsg(await deleteEmailTemplate(t.id)); }) },
          ]}
          onOpen={(t) => setEditing({ id: t.id, name: t.name, subject: t.subject, body: t.body })}
          empty="No templates yet. Save the emails you send often."
          toolbar={<Button onClick={() => setEditing({ name: "", subject: "", body: "" })}><Plus /> New template</Button>}
        />
      )}

      <ResponsivePanel open={compose !== null} onOpenChange={(o) => !o && setCompose(null)} id="workspace-email-compose" defaultWidth={600} fullHeight
        title="New email" description={`From you, via Redial. Replies come to your email. ${workspaceName}.`}
        footer={
          <div className="space-y-2">
            {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
            <Button size="lg" className="w-full" disabled={pending || !compose?.to.length || !compose?.subject.trim() || !compose?.body.trim()} onClick={send}>
              <Send /> {pending ? "Sending…" : (compose?.to.length ?? 0) > 1 ? `Send to ${compose!.to.length}` : "Send"}
            </Button>
          </div>
        }>
        {compose && (
          <div className="space-y-3">
            {templates.length > 0 && (
              <div className="slide-row flex gap-1.5">
                {templates.slice(0, 12).map((t) => (
                  <Button key={t.id} size="sm" variant="outline" onClick={() => setCompose({ ...compose, subject: t.subject || compose.subject, body: t.body })}>{t.name}</Button>
                ))}
              </div>
            )}
            <MultiCombobox autoFocus label="To" placeholder="Search contacts or type an email" empty="No match. Type a full email address."
              options={toOptions} value={compose.to} create={typed} onChange={(to) => setCompose({ ...compose, to })} />
            <Input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} placeholder="Subject" aria-label="Subject" maxLength={300} />
            <Textarea rows={12} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} placeholder="Write your email" aria-label="Message" />
            <p className="text-xs text-muted-foreground">Each person gets their own copy. Up to 25 people per email and 150 a day.</p>
          </div>
        )}
      </ResponsivePanel>

      <ResponsivePanel open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id="workspace-email-template" defaultWidth={560}
        title={editing?.id ? "Edit template" : "New template"}
        footer={<Button className="w-full" disabled={pending || !editing?.name.trim()} onClick={saveTemplate}>Save template</Button>}>
        {editing && (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="tpl-name">Name</Label><Input id="tpl-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} /></div>
            <div className="space-y-1.5"><Label htmlFor="tpl-subject">Subject</Label><Input id="tpl-subject" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} maxLength={300} /></div>
            <div className="space-y-1.5"><Label htmlFor="tpl-body">Message</Label><Textarea id="tpl-body" rows={12} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></div>
            {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
          </div>
        )}
      </ResponsivePanel>
    </div>
  );
}
