"use client";

import { useEffect, useState, useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendEmails, sendTestEmail, templateOptions, type TemplateOption } from "@/lib/admin/actions/comms";
import { MERGE_FIELDS } from "@/lib/comms/blocks";
import { PeopleField, type Person } from "./email/people-field";
import { TemplatePicker } from "./email/template-picker";

export type { Person };

// Send an email from a CRM page: To, Subject with the Templates picker beside
// it, then the message (or the template). Each person gets their own copy
// with their details filled in; unsubscribed addresses are skipped.
export function ComposeDialog({ people = [], initial = [], dealId, onClose, onSent }: {
  people?: Person[]; initial?: Person[]; dealId?: string | null; onClose: () => void; onSent?: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [to, setTo] = useState<Person[]>(initial);
  const [typed, setTyped] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  useEffect(() => { templateOptions().then(setTemplates).catch(() => setTemplates([])); }, []);
  const template = templates.find((t) => t.id === templateId);
  const content = { templateId, subject, body };
  const target = { contactIds: to.filter((p) => p.email).map((p) => p.id), emails: typed, dealId };

  const send = () => start(async () => {
    const res = await sendEmails({ ...content, ...target });
    setResult(res);
    if (res.ok) onSent?.(res.ok);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Send email" className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <div className="space-y-1.5"><Label>To</Label><PeopleField people={people} to={to} setTo={setTo} typed={typed} setTyped={setTyped} /></div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="cmp-subject">Subject</Label>
            <Input id="cmp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={template?.subject || "Subject"} />
          </div>
          <TemplatePicker templates={templates} value={templateId} onChange={(t) => { setTemplateId(t?.id ?? null); setSubject(t?.subject ?? ""); }} className="w-48" />
        </div>
        {template ? (
          <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">Using <span className="font-medium">{template.name}</span>{template.status !== "active" && <span className="text-amber-700 dark:text-amber-300"> · {template.status}: make it Active to send</span>}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="cmp-body">Message</Label>
            <Textarea id="cmp-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{first_name}}," />
            <div className="flex flex-wrap gap-1">
              {MERGE_FIELDS.slice(0, 7).map((m) => <button key={m.token} type="button" onClick={() => setBody(`${body}${m.token}`)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
            </div>
          </div>
        )}
        {(result.ok || result.error) && <p role="status" className={result.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{result.error ?? result.ok}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{result.ok && !result.ok.startsWith("Test") ? "Done" : "Cancel"}</Button>
          <Button variant="outline" disabled={pending || (!templateId && !(subject.trim() && body.trim()))} onClick={() => start(async () => setResult(await sendTestEmail(content, target)))}><FlaskConical /> Test to me</Button>
          <Button onClick={send} disabled={pending || (!to.some((p) => p.email) && !typed.trim()) || (!templateId && !body.trim())}>{pending ? "Sending…" : "Send"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
