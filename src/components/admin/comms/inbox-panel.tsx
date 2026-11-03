"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Archive, ArrowLeft, Globe, Inbox as InboxIcon, Mail, MailOpen, Paperclip, Reply, Trash2, UserPlus, GitBranchPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { convertInbox, deleteInbox, replyInbox, setInboxStatus } from "@/lib/admin/actions/comms";
import type { InboxMessage } from "@/lib/comms/data";
import { cn } from "@/lib/utils";
import { EmptyState, SearchBox } from "@/components/admin/crm/crm-kit";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const FOLDERS = [{ id: "open", label: "Inbox" }, { id: "archived", label: "Archived" }, { id: "all", label: "All" }] as const;

// Contact and support messages: inbound email to support@/hello@ and the
// website form. Shown as plain text. Reply, save to the CRM, or open a deal.
export function InboxPanel({ messages, readOnly, canCrm }: { messages: InboxMessage[]; readOnly: boolean; canCrm: boolean }) {
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]["id"]>("open");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); setMsg(r); if (!r.error) after?.(); });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => (folder === "all" || (folder === "archived" ? m.status === "archived" : m.status !== "archived"))
      && (!q || `${m.from_name ?? ""} ${m.from_email ?? ""} ${m.subject ?? ""} ${m.body} ${m.company ?? ""}`.toLowerCase().includes(q)));
  }, [messages, folder, search]);
  const unread = messages.filter((m) => m.status === "new").length;
  const m = messages.find((x) => x.id === openId) ?? null;
  const ids = [...selected];

  const open = (x: InboxMessage) => {
    setOpenId(x.id); setReply("");
    if (x.status === "new" && !readOnly) start(async () => { await setInboxStatus([x.id], "read"); });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {FOLDERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFolder(f.id)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", folder === f.id ? "bg-accent" : "text-muted-foreground hover:text-foreground")}>
              {f.label}{f.id === "open" && unread > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread}</span>}
            </button>
          ))}
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search messages…" />
        <span className="ml-auto text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
      </div>

      {selected.size > 0 && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2 pl-3 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setInboxStatus(ids, "read"), () => setSelected(new Set()))}><MailOpen /> Mark read</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setInboxStatus(ids, "new"), () => setSelected(new Set()))}><Mail /> Mark unread</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setInboxStatus(ids, "archived"), () => setSelected(new Set()))}><Archive /> Archive</Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => confirm(`Delete ${ids.length} messages?`) && run(() => deleteInbox(ids), () => setSelected(new Set()))}><Trash2 /> Delete</Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={cn("min-w-0", m && "hidden lg:block")}>
          {shown.length === 0 ? <EmptyState message={messages.length ? "Nothing here." : "No messages yet. Website form submissions and emails to your inbound address land here."} /> : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {shown.map((x) => (
                <li key={x.id} className={cn("flex items-start gap-2 p-3", openId === x.id && "bg-accent/60")}>
                  {!readOnly && <input type="checkbox" className="mt-1" checked={selected.has(x.id)} aria-label="Select message"
                    onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} />}
                  <button type="button" onClick={() => open(x)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5">
                      {x.channel === "form" ? <Globe className="size-3.5 shrink-0 text-muted-foreground" /> : <Mail className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span className={cn("min-w-0 flex-1 truncate text-sm", x.status === "new" && "font-semibold")}>{x.from_name || x.from_email || "Unknown"}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(x.created_at)}</span>
                    </span>
                    <span className={cn("block truncate text-sm", x.status === "new" ? "text-foreground" : "text-muted-foreground")}>{x.subject || "(no subject)"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{x.body.slice(0, 140)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn("min-w-0", !m && "hidden lg:block")}>
          {!m ? <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-sm text-muted-foreground"><InboxIcon className="size-6" />Select a message</div> : (
            <article className="space-y-4 rounded-xl border bg-card p-4">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpenId(null)}><ArrowLeft /> Inbox</Button>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{m.subject || "(no subject)"}</h2>
                <p className="text-sm">
                  <span className="font-medium">{m.from_name || m.from_email}</span>
                  {m.from_name && m.from_email && <span className="text-muted-foreground"> &lt;{m.from_email}&gt;</span>}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline">{m.channel === "form" ? "Website form" : "Email"}</Badge>
                  {m.topic && <Badge variant="outline">{m.topic}</Badge>}
                  {when(m.created_at)}{m.to_email ? ` · to ${m.to_email}` : ""}{m.phone ? ` · ${m.phone}` : ""}{m.company ? ` · ${m.company}` : ""}
                </p>
              </div>
              <p className="max-h-[50dvh] overflow-y-auto rounded-lg border p-3 text-sm break-words whitespace-pre-wrap">{m.body || "(empty)"}</p>
              {(m.meta.attachments?.length ?? 0) > 0 && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Paperclip className="size-3.5" />{m.meta.attachments!.map((a) => a.name).join(", ")} (open in Resend to download)</p>
              )}
              {m.contact_id && <Link href={`/admin/contacts/${m.contact_id}`} className="inline-block text-sm text-primary hover:underline">Open contact →</Link>}
              {!readOnly && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {canCrm && !m.contact_id && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => convertInbox(m.id, "lead"))}><UserPlus /> Save as lead</Button>}
                    {canCrm && !m.contact_id && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => convertInbox(m.id, "contact"))}><UserPlus /> Save as contact</Button>}
                    {canCrm && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => convertInbox(m.id, "pipeline"))}><GitBranchPlus /> Add to pipeline</Button>}
                    {m.status !== "archived"
                      ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setInboxStatus([m.id], "archived"), () => setOpenId(null))}><Archive /> Archive</Button>
                      : <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setInboxStatus([m.id], "read"))}><InboxIcon /> Move to inbox</Button>}
                    <Button size="icon-sm" variant="ghost" aria-label="Delete message" disabled={pending} onClick={() => confirm("Delete this message?") && run(() => deleteInbox([m.id]), () => setOpenId(null))}><Trash2 /></Button>
                  </div>
                  {m.from_email && (
                    <div className="space-y-2">
                      <Textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${m.from_name?.split(" ")[0] || m.from_email}…`} aria-label="Reply" />
                      <Button size="sm" disabled={pending || !reply.trim()} onClick={() => run(() => replyInbox(m.id, reply), () => setReply(""))}><Reply /> {pending ? "Sending…" : "Send reply"}</Button>
                    </div>
                  )}
                </>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
