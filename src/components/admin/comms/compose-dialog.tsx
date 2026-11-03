"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendEmails, templateOptions } from "@/lib/admin/actions/comms";
import { MERGE_FIELDS } from "@/lib/comms/blocks";

export type Person = { id: string; name: string; email: string | null };
type Option = { id: string; name: string; subject: string; category: string };
const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

// Send an email from Echo (Resend): a saved template or a quick message, to
// CRM contacts and/or typed addresses. Each person gets their own copy with
// their merge fields; unsubscribed addresses are skipped.
export function ComposeDialog({ people = [], initial = [], dealId, onClose, onSent }: {
  people?: Person[]; initial?: Person[]; dealId?: string | null; onClose: () => void; onSent?: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<Option[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [to, setTo] = useState<Person[]>(initial);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  useEffect(() => { templateOptions().then(setTemplates).catch(() => setTemplates([])); }, []);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => p.email && !to.some((t) => t.id === p.id) && `${p.name} ${p.email}`.toLowerCase().includes(q)).slice(0, 8);
  }, [people, query, to]);
  const noEmail = to.filter((p) => !p.email).length;
  const template = templates?.find((t) => t.id === templateId);

  const send = () => start(async () => {
    const res = await sendEmails({ templateId: templateId || null, subject, body, contactIds: to.map((p) => p.id), emails: typed, dealId });
    setResult(res);
    if (res.ok) onSent?.(res.ok);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Send email" className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <div className="space-y-1.5">
          <Label>To</Label>
          <div className="flex flex-wrap gap-1.5 rounded-lg border p-2">
            {to.map((p) => (
              <Badge key={p.id} variant={p.email ? "secondary" : "outline"} className="gap-1" title={p.email ?? "No email address"}>
                {p.name}{!p.email && " (no email)"}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setTo(to.filter((x) => x.id !== p.id))}><X className="size-3" /></button>
              </Badge>
            ))}
            {people.length > 0 && (
              <div className="relative min-w-40 flex-1">
                <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a contact…" className="h-7 w-full bg-transparent pl-7 text-sm outline-none" aria-label="Add a contact" />
                {matches.length > 0 && (
                  <ul className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-popover p-1 shadow-md">
                    {matches.map((p) => (
                      <li key={p.id}><button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { setTo([...to, p]); setQuery(""); }}>
                        {p.name} <span className="text-xs text-muted-foreground">{p.email}</span></button></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Other addresses, comma separated" aria-label="Other email addresses" />
          {noEmail > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{noEmail} selected {noEmail === 1 ? "has" : "have"} no email address and will be skipped.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cmp-template">Template</Label>
          <select id="cmp-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={SELECT} disabled={!templates}>
            <option value="">{templates ? "No template: write a message" : "Loading…"}</option>
            {templates?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-subject">Subject</Label>
          <Input id="cmp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={template?.subject || "Subject"} />
          {template && <p className="text-xs text-muted-foreground">Leave blank to use the template&apos;s subject.</p>}
        </div>
        {!templateId && (
          <div className="space-y-1.5">
            <Label htmlFor="cmp-body">Message</Label>
            <Textarea id="cmp-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{first_name}}," />
            <div className="flex flex-wrap gap-1">
              {MERGE_FIELDS.slice(0, 7).map((m) => <button key={m.token} type="button" onClick={() => setBody(`${body}${m.token}`)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
            </div>
          </div>
        )}
        {(result.ok || result.error) && <p className={result.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{result.error ?? result.ok}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{result.ok ? "Done" : "Cancel"}</Button>
          {!result.ok && <Button onClick={send} disabled={pending || (!to.some((p) => p.email) && !typed.trim()) || (!templateId && !body.trim())}>{pending ? "Sending…" : "Send"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
