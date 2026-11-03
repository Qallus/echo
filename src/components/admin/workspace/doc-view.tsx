"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { addWorkspaceComment, deleteWorkspaceComment, resolveWorkspaceComment } from "@/lib/admin/actions/workspace";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import type { WorkspaceComment, WorkspaceDoc, WorkspaceDocMeta } from "@/lib/workspace/data";
import { cn } from "@/lib/utils";
import { DocHeader } from "./doc-header";
import { WorkspaceEditor } from "./editor";

// One workspace page: header, editor and the comments panel.
export function DocView({ doc, docs, comments, staff, me, editable, canDelete, canModerate }: {
  doc: WorkspaceDoc; docs: WorkspaceDocMeta[]; comments: WorkspaceComment[]; staff: StaffOption[]; me: string; editable: boolean; canDelete: boolean; canModerate: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const open = comments.filter((c) => !c.resolved).length;
  const byline = `Edited ${new Date(doc.updated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${doc.updated_by ? ` by ${ownerName(staff, doc.updated_by)}` : ""}`;
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6">
      <DocHeader doc={doc} docs={docs} editable={editable} canDelete={canDelete} commentCount={open} onComments={() => { setQuote(window.getSelection()?.toString().trim().slice(0, 500) || null); setShowComments(true); }} byline={byline} />
      {!editable && <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">You can read and comment on this page. Ask its author or an admin to edit it.</p>}
      <WorkspaceEditor docId={doc.id} initial={doc.content} editable={editable} />
      <Comments open={showComments} onOpenChange={setShowComments} docId={doc.id} comments={comments} staff={staff} me={me} canModerate={canModerate} quote={quote} onClearQuote={() => setQuote(null)} />
    </article>
  );
}

function Comments({ open, onOpenChange, docId, comments, staff, me, canModerate, quote, onClearQuote }: {
  open: boolean; onOpenChange: (o: boolean) => void; docId: string; comments: WorkspaceComment[]; staff: StaffOption[]; me: string; canModerate: boolean;
  quote: string | null; onClearQuote: () => void;
}) {
  const [body, setBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const shown = comments.filter((c) => showResolved || !c.resolved);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <div className="flex items-center justify-between border-b p-4 pr-12">
          <SheetTitle>Comments</SheetTitle>
          {comments.some((c) => c.resolved) && <Button size="xs" variant="ghost" onClick={() => setShowResolved(!showResolved)}>{showResolved ? "Hide resolved" : "Show resolved"}</Button>}
        </div>
        <ul className="flex-1 space-y-3 overflow-y-auto p-4">
          {shown.length === 0 && <li className="text-sm text-muted-foreground">No comments yet. Select text on the page first to quote it.</li>}
          {shown.map((c) => (
            <li key={c.id} className={cn("space-y-1.5 rounded-xl border p-3 text-sm", c.resolved && "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.created_by ? ownerName(staff, c.created_by) : "Someone"}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              {c.quote && <p className="border-l-2 pl-2 text-xs text-muted-foreground italic">{c.quote}</p>}
              <p className="whitespace-pre-wrap">{c.body}</p>
              <div className="flex gap-1">
                <Button size="xs" variant="ghost" disabled={pending} onClick={() => start(async () => { await resolveWorkspaceComment(c.id, docId, !c.resolved); })}>
                  {c.resolved ? <><RotateCcw /> Reopen</> : <><Check /> Resolve</>}
                </Button>
                {(c.created_by === me || canModerate) && <Button size="xs" variant="ghost" className="text-destructive" disabled={pending} onClick={() => start(async () => { await deleteWorkspaceComment(c.id, docId); })}><Trash2 /> Delete</Button>}
              </div>
            </li>
          ))}
        </ul>
        <form className="space-y-2 border-t p-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => { const r = await addWorkspaceComment(docId, body, quote); if (r.error) setError(r.error); else { setBody(""); setError(undefined); onClearQuote(); } });
        }}>
          {quote && <p className="flex items-start gap-2 border-l-2 pl-2 text-xs text-muted-foreground italic"><span className="line-clamp-3 flex-1">{quote}</span><button type="button" className="not-italic hover:text-foreground" onClick={onClearQuote}>Remove</button></p>}
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" aria-label="Comment" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>Comment</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
