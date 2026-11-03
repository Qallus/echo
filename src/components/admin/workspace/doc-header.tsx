"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderInput, Globe, Lock, MessageSquare, MoreHorizontal, Pin, PinOff, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deleteWorkspaceDoc, duplicateWorkspaceDoc, updateWorkspaceDoc } from "@/lib/admin/actions/workspace";
import type { WorkspaceDocMeta } from "@/lib/workspace/data";
import { NewPageMenu } from "./workspace-nav";

const ICONS = ["📄", "📝", "🗓️", "🧭", "📑", "🎯", "📌", "💡", "✅", "📣", "🚀", "🧾", "📊", "🤝", "🛠️", "📚", "🔒", "⭐"];

// Title, icon and page actions (share level, pin, move, duplicate, delete).
export function DocHeader({ doc, docs, editable, canDelete, commentCount, onComments, byline }: {
  doc: WorkspaceDocMeta; docs: WorkspaceDocMeta[]; editable: boolean; canDelete: boolean; commentCount: number; onComments: () => void; byline: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const save = (patch: Parameters<typeof updateWorkspaceDoc>[1]) => start(async () => { const r = await updateWorkspaceDoc(doc.id, patch); setMsg(r.error); });
  // Pages that can be a parent: anything that isn't this page or below it.
  const below = new Set<string>([doc.id]);
  for (let grew = true; grew;) { grew = false; for (const d of docs) if (d.parent_id && below.has(d.parent_id) && !below.has(d.id)) { below.add(d.id); grew = true; } }
  const parents = docs.filter((d) => !below.has(d.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {doc.visibility === "private" ? <><Lock className="size-3" /> Private: only you</> : <><Globe className="size-3" /> Team</>}
          <span aria-hidden>·</span> {byline}
        </span>
        <span className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onComments}><MessageSquare /> {commentCount || ""} Comments</Button>
          {editable && <NewPageMenu parentId={doc.id} label="Sub-page" variant="ghost" />}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Page actions" disabled={pending} />}><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {editable && <>
                <DropdownMenuItem onClick={() => save({ pinned: !doc.pinned })}>{doc.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin to top</>}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => save({ visibility: doc.visibility === "team" ? "private" : "team" })}>
                  {doc.visibility === "team" ? <><Lock /> Make private</> : <><Globe /> Share with the team</>}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderInput /> Move to</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto">
                    <DropdownMenuItem onClick={() => save({ parent_id: null })}>Top level</DropdownMenuItem>
                    {parents.map((d) => <DropdownMenuItem key={d.id} onClick={() => save({ parent_id: d.id })}><span aria-hidden>{d.icon ?? "📄"}</span> <span className="truncate">{d.title}</span></DropdownMenuItem>)}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>}
              <DropdownMenuItem onClick={() => start(async () => { const r = await duplicateWorkspaceDoc(doc.id); if (r.id) router.push(`/admin/workspace/${r.id}`); else setMsg(r.error); })}><Copy /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}><Printer /> Print or save as PDF</DropdownMenuItem>
              {canDelete && <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => confirm(`Delete "${doc.title}" and its sub-pages?`) && start(async () => {
                  const r = await deleteWorkspaceDoc(doc.id);
                  if (r.error) setMsg(r.error); else router.push("/admin/workspace");
                })}><Trash2 /> Delete</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      <div className="flex items-start gap-2">
        <Popover>
          <PopoverTrigger render={<button type="button" disabled={!editable} aria-label="Change icon" className="rounded-lg px-1 text-4xl leading-tight hover:bg-muted disabled:hover:bg-transparent" />}>
            {doc.icon ?? "📄"}
          </PopoverTrigger>
          <PopoverContent align="start" className="grid w-64 grid-cols-6 gap-1">
            {ICONS.map((i) => <button key={i} type="button" className="rounded-md p-1 text-xl hover:bg-muted" onClick={() => save({ icon: i })}>{i}</button>)}
          </PopoverContent>
        </Popover>
        <input value={title} readOnly={!editable} aria-label="Page title" maxLength={200}
          onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() !== doc.title && save({ title: title.trim() || "Untitled" })}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground sm:text-4xl" placeholder="Untitled" />
      </div>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
