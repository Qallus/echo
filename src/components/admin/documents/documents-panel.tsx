"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Download, File, FileImage, FileSpreadsheet, FileText, Folder as FolderIcon, FolderPlus, LayoutGrid, Link2, List, Loader2, Pencil, Tag, Trash2, Upload, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createFolder, deleteDocuments, deleteFolder, documentLink, moveDocuments, registerDocument, renameFolder, tagDocuments, updateDocument,
} from "@/lib/admin/actions/documents";
import type { Doc, Folder } from "@/lib/documents/data";
import { ownerName, type StaffOption } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { BulkBar, type BulkAction } from "@/components/admin/crm/bulk-bar";
import { SearchBox, ViewSwitcher } from "@/components/admin/crm/crm-kit";

const MAX = 50 * 1024 * 1024;
const size = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const iconFor = (mime: string | null) => (mime?.startsWith("image/") ? FileImage : mime?.includes("pdf") || mime?.startsWith("text/") || mime?.includes("word") ? FileText
  : mime?.includes("sheet") || mime?.includes("csv") || mime?.includes("excel") ? FileSpreadsheet : File);
const VIEWS = [{ id: "list" as const, label: "List", icon: List }, { id: "grid" as const, label: "Grid", icon: LayoutGrid }];
const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, "_").slice(-120) || "file";

// Files for the business: folders, drag-and-drop upload, preview, share
// links that expire, tags, links to clients, contacts and deals.
export function DocumentsPanel({ docs, folders, staff, companies, readOnly }: {
  docs: Doc[]; folders: Folder[]; staff: StaffOption[]; companies: { id: string; name: string }[]; readOnly: boolean;
}) {
  const [folder, setFolder] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, clear = false) => start(async () => { const r = await fn(); setMsg(r); if (!r.error && clear) setSelected(new Set()); });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => (q ? true : folder === null || d.folder_id === folder) && (!q || `${d.name} ${d.tags.join(" ")} ${d.notes ?? ""}`.toLowerCase().includes(q)));
  }, [docs, folder, search]);
  const ids = [...selected];
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const open = docs.find((d) => d.id === openId) ?? null;
  const usage = docs.reduce((n, d) => n + d.size, 0);

  async function upload(files: FileList | File[]) {
    if (readOnly) return;
    const list = [...files];
    const tooBig = list.filter((f) => f.size > MAX);
    if (tooBig.length) setMsg({ error: `${tooBig.map((f) => f.name).join(", ")} ${tooBig.length > 1 ? "are" : "is"} over 50 MB.` });
    const supabase = createClient();
    for (const f of list.filter((x) => x.size <= MAX)) {
      setUploading((u) => [...u, f.name]);
      const id = crypto.randomUUID();
      const path = `${id}/${safeName(f.name)}`;
      const { error } = await supabase.storage.from("documents").upload(path, f, { contentType: f.type || undefined, upsert: false });
      const res = error ? { error: error.message } : await registerDocument({ id, name: f.name, path, size: f.size, mime: f.type || "application/octet-stream", folder_id: folder });
      setMsg(res);
      setUploading((u) => u.filter((n) => n !== f.name));
    }
  }
  const openLink = (id: string) => start(async () => { const r = await documentLink(id); if (r.url) window.open(r.url, "_blank", "noopener"); else setMsg(r); });

  const bulk: BulkAction[] = [
    { label: "Download", icon: Download, run: () => ids.forEach((id) => openLink(id)) },
    ...(readOnly ? [] : [
      { label: "Move to", icon: FolderIcon, options: [{ value: "", label: "All files (no folder)" }, ...folders.map((f) => ({ value: f.id, label: f.name }))], onPick: (v: string) => run(() => moveDocuments(ids, v || null), true) },
      { label: "Tag", icon: Tag, input: { placeholder: "Tags, comma separated", submit: "Add tags", onSubmit: (v: string) => run(() => tagDocuments(ids, v), true) } },
      { label: "Delete", icon: Trash2, destructive: true, run: () => confirm(`Delete ${ids.length} files? This can't be undone.`) && run(() => deleteDocuments(ids), true) },
    ]),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-1">
        <button type="button" onClick={() => setFolder(null)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm", folder === null ? "bg-accent font-medium" : "hover:bg-muted")}>
          <FolderIcon className="size-4" /> All files <span className="ml-auto text-xs text-muted-foreground">{docs.length}</span>
        </button>
        {folders.map((f) => (
          <div key={f.id} className="group flex items-center">
            <button type="button" onClick={() => setFolder(f.id)} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm", folder === f.id ? "bg-accent font-medium" : "hover:bg-muted")}>
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{f.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{docs.filter((d) => d.folder_id === f.id).length}</span>
            </button>
            {!readOnly && <>
              <Button size="icon-xs" variant="ghost" aria-label={`Rename ${f.name}`} className="sm:opacity-0 sm:group-hover:opacity-100" onClick={() => { const n = prompt("Folder name", f.name); if (n) run(() => renameFolder(f.id, n)); }}><Pencil /></Button>
              <Button size="icon-xs" variant="ghost" aria-label={`Delete ${f.name}`} className="sm:opacity-0 sm:group-hover:opacity-100" onClick={() => confirm(`Delete the "${f.name}" folder? Its files stay in All files.`) && run(() => deleteFolder(f.id))}><Trash2 /></Button>
            </>}
          </div>
        ))}
        {!readOnly && <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => { const n = prompt("New folder name"); if (n) run(() => createFolder(n, null)); }}><FolderPlus /> New folder</Button>}
        <p className="px-2.5 pt-3 text-xs text-muted-foreground">{size(usage)} used</p>
      </aside>

      <div className="min-w-0 space-y-3"
        onDragOver={(e) => { if (!readOnly && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search files…" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{msg.error ?? msg.ok}</span>
            <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
            {!readOnly && <Button onClick={() => fileInput.current?.click()}><Upload /> Upload</Button>}
            <input ref={fileInput} type="file" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
          </div>
        </div>
        {uploading.length > 0 && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Uploading {uploading.join(", ")}…</p>}
        <BulkBar count={selected.size} total={shown.length} pending={pending} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(shown.map((d) => d.id)))} actions={bulk} />

        <div className={cn("rounded-xl transition", drag && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              <Upload className="size-6" />{readOnly ? "No files here." : "Drop files here, or use Upload. Up to 50 MB each."}
            </div>
          ) : view === "list" ? (
            <ul className="divide-y rounded-xl border bg-card">
              {shown.map((d) => {
                const Icon = iconFor(d.mime);
                return (
                  <li key={d.id} className="flex items-center gap-3 p-2.5">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${d.name}`} />
                    <Icon className="size-5 shrink-0 text-muted-foreground" />
                    <button type="button" onClick={() => setOpenId(d.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{d.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{size(d.size)} · {new Date(d.created_at).toLocaleDateString()}{d.uploaded_by ? ` · ${ownerName(staff, d.uploaded_by)}` : ""}</span>
                    </button>
                    <span className="hidden gap-1 md:flex">{d.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={`Open ${d.name}`} onClick={() => openLink(d.id)}><Download /></Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((d) => {
                const Icon = iconFor(d.mime);
                return (
                  <div key={d.id} className="relative rounded-xl border bg-card p-3">
                    <input type="checkbox" className="absolute top-2 left-2" checked={selected.has(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${d.name}`} />
                    <button type="button" onClick={() => setOpenId(d.id)} className="flex w-full flex-col items-center gap-2 pt-3 text-center">
                      <Icon className="size-10 text-muted-foreground" />
                      <span className="w-full truncate text-sm font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{size(d.size)}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {open && <DocSheet key={open.id + open.updated_at} doc={open} folders={folders} companies={companies} readOnly={readOnly} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DocSheet({ doc, folders, companies, readOnly, onClose }: { doc: Doc; folders: Folder[]; companies: { id: string; name: string }[]; readOnly: boolean; onClose: () => void }) {
  const [name, setName] = useState(doc.name);
  const [tags, setTags] = useState(doc.tags.join(", "));
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const save = (patch: Parameters<typeof updateDocument>[1]) => start(async () => setMsg(await updateDocument(doc.id, patch)));
  const canPreview = doc.mime?.startsWith("image/") || doc.mime === "application/pdf" || doc.mime?.startsWith("text/");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-xl">
        <SheetTitle className="truncate pt-4 pr-6">{doc.name}</SheetTitle>
        <div className="space-y-4 pt-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await documentLink(doc.id); if (r.url) window.open(r.url, "_blank", "noopener"); else setMsg(r); })}><Download /> Open</Button>
            {canPreview && !preview && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await documentLink(doc.id); if (r.url) setPreview(r.url); else setMsg(r); })}>Preview</Button>}
            <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await documentLink(doc.id, 7); if (r.url) { setShare(r.url); await navigator.clipboard.writeText(r.url).catch(() => {}); } else setMsg(r); })}><Link2 /> Share link (7 days)</Button>
          </div>
          {share && <p className="rounded-lg border bg-muted/40 p-2 text-xs break-all">Copied: {share}</p>}
          {preview && (doc.mime?.startsWith("image/")
            ? <img src={preview} alt={doc.name} className="max-h-96 w-full rounded-lg border object-contain" /> // eslint-disable-line @next/next/no-img-element
            : <iframe src={preview} title={doc.name} sandbox="allow-same-origin" className="h-96 w-full rounded-lg border bg-white" />)}
          <div className="space-y-1.5"><Label htmlFor="dc-name">Name</Label><Input id="dc-name" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== doc.name && save({ name })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="dc-folder">Folder</Label>
              <Pick id="dc-folder" label="Folder" value={doc.folder_id ?? ""} disabled={readOnly} onChange={(v) => save({ folder_id: v || null })} options={[{ value: "", label: "All files" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]} />
            </div>
            <div className="space-y-1.5"><Label htmlFor="dc-client">Client</Label>
              <Pick id="dc-client" label="Client" value={doc.company_id ?? ""} disabled={readOnly} onChange={(v) => save({ company_id: v || null })} options={[{ value: "", label: "None" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="dc-tags">Tags</Label><Input id="dc-tags" value={tags} disabled={readOnly} onChange={(e) => setTags(e.target.value)} onBlur={() => save({ tags })} placeholder="Comma separated" /></div>
          <div className="space-y-1.5"><Label htmlFor="dc-notes">Notes</Label><Textarea id="dc-notes" rows={3} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (doc.notes ?? "") && save({ notes })} /></div>
          <p className="text-xs text-muted-foreground">{size(doc.size)} · {doc.mime} · added {new Date(doc.created_at).toLocaleString()}</p>
          {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
          {!readOnly && <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => confirm(`Delete ${doc.name}?`) && start(async () => { await deleteDocuments([doc.id]); onClose(); })}><Trash2 /> Delete file</Button>}
          <Button variant="ghost" size="sm" onClick={onClose}><X /> Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
