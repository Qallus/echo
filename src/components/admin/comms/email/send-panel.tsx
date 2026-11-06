"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, FlaskConical, Pencil, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { previewEmail, saveAudience, sendEmails, sendTestEmail } from "@/lib/admin/actions/comms";
import { audienceLabel, type Audience } from "@/lib/comms/audience";
import { MERGE_FIELDS, applyMerge, plainToSchema, renderTemplate } from "@/lib/comms/blocks";
import type { Preview } from "@/lib/comms/email";
import type { SavedAudience, Template } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { AudienceBuilder } from "./audience-builder";
import { EmailPreview } from "./email-preview";
import { PeopleField, type Person } from "./people-field";
import { Pick } from "./pick";
import { TemplatePicker } from "./template-picker";

export const SAMPLE = { first_name: "Dana", last_name: "Whitfield", full_name: "Dana Whitfield", email: "dana@example.com", company: "Oasis Resorts", title: "VP Operations", owner: "Jeremy", deal: "Oasis: Business plan", stage: "Proposal", amount: "$4,800", site_url: "https://echo.redial.si", org_name: "Echo", unsubscribe_url: "#" };

// Send an email: To (people or an audience), Subject with the Templates picker
// beside it, then the email itself. The server checks every send (counts,
// unsubscribes, a test before bulk sends) and the preview shows that live.
export function SendPanel({ templates, people, audiences, knownTags, canCustomers, onEditTemplate }: {
  templates: Template[]; people: Person[]; audiences: SavedAudience[]; knownTags: string[]; canCustomers: boolean; onEditTemplate: (t: Template) => void;
}) {
  const [mode, setMode] = useState<"people" | "audience">("people");
  const [to, setTo] = useState<Person[]>([]);
  const [typed, setTyped] = useState("");
  const [audience, setAudience] = useState<Audience>({ source: "contacts" });
  const [audienceName, setAudienceName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const template = templates.find((t) => t.id === templateId) ?? null;

  const content = useMemo(() => ({ templateId, subject, body }), [templateId, subject, body]);
  const target = useMemo(() => (mode === "audience" ? { audience } : { contactIds: to.filter((p) => p.email).map((p) => p.id), emails: typed }), [mode, audience, to, typed]);
  const hasTarget = mode === "audience" || to.some((p) => p.email) || typed.trim().length > 3;
  const hasContent = Boolean(templateId || (subject.trim() && body.trim()));

  // Live preview from the server: who it goes to, and anything in the way.
  useEffect(() => {
    if (!hasContent || !hasTarget) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await previewEmail(content, target);
      if (!live) return;
      if ("error" in res) { setPreview(null); setPreviewError(res.error); } else { setPreview(res); setPreviewError(null); }
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [content, target, hasContent, hasTarget]);

  // What the email looks like before there's anyone to fill it in for.
  const localHtml = useMemo(() => {
    const rendered = template ? renderTemplate({ mode: template.mode, schema: template.schema, html: template.html, preheader: template.preheader })
      : body.trim() ? renderTemplate({ mode: "blocks", schema: plainToSchema(body), html: "" }) : null;
    return rendered ? applyMerge(rendered.html, SAMPLE, true) : "";
  }, [template, body]);
  const ready = hasContent && hasTarget && preview && !previewError;
  const shownHtml = ready ? preview.html : localHtml;
  const blocked = !ready || preview.sendable === 0 || preview.problems.length > 0;

  const pickTemplate = (t: { id: string; subject: string } | null) => { setTemplateId(t?.id ?? null); setSubject(t?.subject ?? ""); setMsg({}); };
  const test = () => start(async () => setMsg(await sendTestEmail(content, hasTarget ? target : null)));
  const send = () => start(async () => {
    const res = await sendEmails({ ...content, ...target, maxTotal: preview?.total });
    setMsg(res); setConfirming(false);
    if (res.ok) { setTo([]); setTyped(""); }
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Label className="w-16 shrink-0">To</Label>
          <div className="flex gap-1 rounded-lg border p-0.5">
            {(["people", "audience"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                className={cn("rounded-md px-3 py-1 text-sm", mode === m ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>
                {m === "people" ? "People" : "Audience (bulk)"}
              </button>
            ))}
          </div>
        </div>

        {mode === "people" ? <PeopleField people={people} to={to} setTo={setTo} typed={typed} setTyped={setTyped} /> : (
          <div className="space-y-3 rounded-lg border p-3">
            {audiences.length > 0 && (
              <Pick label="Saved audience" value={""} onChange={(id) => { const a = audiences.find((x) => x.id === id); if (a) { setAudience(a.definition); setAudienceName(a.name); } }}
                options={[{ value: "", label: "Start from a saved audience…" }, ...audiences.map((a) => ({ value: a.id, label: a.name }))]} />
            )}
            <AudienceBuilder value={audience} onChange={setAudience} knownTags={knownTags} canCustomers={canCustomers} />
            <div className="flex items-center gap-2 border-t pt-3">
              <Input value={audienceName} onChange={(e) => setAudienceName(e.target.value)} placeholder="Name this audience to reuse it" aria-label="Audience name" className="h-8" />
              <Button size="sm" variant="outline" disabled={pending || !audienceName.trim()}
                onClick={() => start(async () => setMsg(await saveAudience(audiences.find((a) => a.name === audienceName.trim())?.id ?? null, { name: audienceName, definition: audience })))}>
                <Users /> Save audience
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="send-subject">Subject</Label>
            <Input id="send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Hi {{first_name}}, …" />
          </div>
          <TemplatePicker templates={templates} value={templateId} onChange={pickTemplate} className="w-56" />
        </div>

        {template ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">Using <span className="font-medium">{template.name}</span>{template.status !== "active" && <span className="text-amber-700 dark:text-amber-300"> · {template.status}</span>}</span>
            <Button size="sm" variant="ghost" onClick={() => onEditTemplate(template)}><Pencil /> Edit template</Button>
            <Button size="sm" variant="ghost" onClick={() => pickTemplate(null)}>Clear</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="send-body">Message</Label>
            <Textarea id="send-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{first_name}}," />
            <div className="flex flex-wrap gap-1">
              {MERGE_FIELDS.slice(0, 8).map((m) => <button key={m.token} type="button" onClick={() => setBody(`${body}${m.token}`)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
            </div>
          </div>
        )}

        <Summary preview={ready ? preview : null} error={hasContent && hasTarget ? previewError : null} waiting={hasContent && hasTarget && !preview && !previewError} mode={mode} />
        {(msg.ok || msg.error) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{msg.error ?? msg.ok}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={pending || !hasContent} onClick={test} title="Sends a copy to your own email, filled in for the first recipient"><FlaskConical /> Send test to me</Button>
          <Button disabled={pending || blocked} onClick={() => (preview && preview.total > 1 ? setConfirming(true) : send())}>
            <Send /> {ready ? `Send to ${preview.sendable.toLocaleString()} ${preview.sendable === 1 ? "person" : "people"}` : "Send"}
          </Button>
        </div>
      </section>

      <EmailPreview html={shownHtml || "<p style='font-family:sans-serif;color:#71717a;padding:24px'>Pick a template or write a message.</p>"}
        note={ready && preview.sample[0] ? `as ${preview.sample[0].name || preview.sample[0].email} will see it` : "example contact"} />

      {confirming && preview && (
        <Dialog open onOpenChange={(o) => !o && setConfirming(false)}>
          <DialogContent title="Send this email?" className="max-w-md">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">{preview.firstSubject}</span></p>
              <p>To <span className="font-medium">{preview.sendable.toLocaleString()} {preview.sendable === 1 ? "person" : "people"}</span> · {mode === "audience" ? audienceLabel(audience) : preview.label}</p>
              {preview.unsubscribed > 0 && <p className="text-muted-foreground">{preview.unsubscribed} unsubscribed {preview.unsubscribed === 1 ? "person is" : "people are"} skipped.</p>}
              <p className="text-muted-foreground">Each person gets their own copy with their details filled in. This can&apos;t be undone.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button disabled={pending} onClick={send}>{pending ? "Sending…" : `Send to ${preview.sendable.toLocaleString()}`}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Summary({ preview, error, waiting, mode }: { preview: Preview | null; error: string | null; waiting: boolean; mode: "people" | "audience" }) {
  if (error) return <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="size-4" />{error}</p>;
  if (waiting) return <p className="text-sm text-muted-foreground">Checking recipients…</p>;
  if (!preview) return <p className="text-sm text-muted-foreground">{mode === "audience" ? "Pick an audience and a template or message to see who it goes to." : "Add people and pick a template or write a message."}</p>;
  return (
    <div className="space-y-1.5 rounded-lg border p-3 text-sm">
      <p>
        <span className="font-medium">{preview.sendable.toLocaleString()}</span> of {preview.total.toLocaleString()} will get it
        {preview.unsubscribed > 0 && <span className="text-muted-foreground"> · {preview.unsubscribed} unsubscribed, skipped</span>}
        {preview.bulk && <span className="text-muted-foreground"> · bulk send</span>}
      </p>
      {preview.sample.length > 0 && <p className="truncate text-xs text-muted-foreground">{preview.sample.map((s) => s.name || s.email).join(", ")}{preview.sendable > preview.sample.length ? ", …" : ""}</p>}
      {preview.problems.map((p) => <p key={p} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{p}</p>)}
    </div>
  );
}
