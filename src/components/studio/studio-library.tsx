"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive, ArchiveRestore, CalendarDays, ChevronLeft, ChevronRight, Download, ImagePlus, LayoutGrid, List, MoreVertical, Pencil,
  SquareKanban, Table as TableIcon, Trash2, Upload, X,
} from "lucide-react";
import { AudioPlayer } from "@/components/studio/audio-player";
import { CoverThumb } from "@/components/studio/cover-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { archiveStudioAudio, deleteStudioAudio, updateStudioAudio } from "@/lib/studio/actions";
import { imageToDataUrl } from "@/lib/studio/image";
import { STATUS_META, STUDIO_KINDS, STUDIO_STATUSES, kindLabel, type StudioAudio, type StudioKind, type StudioStatus } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

// The Library tab (adapted from Channel Cast's audio library): every
// recording in five views, with upload, selection and bulk actions.

type View = "cards" | "list" | "table" | "kanban" | "calendar";
const VIEWS: { id: View; label: string; icon: typeof List }[] = [
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "list", label: "List", icon: List },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "kanban", label: "Kanban", icon: SquareKanban },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];
const VIEW_KEY = "studio.view";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const ext = (a: StudioAudio) => (a.mime.includes("wav") ? "WAV" : a.mime.includes("mpeg") || a.mime.includes("mp3") ? "MP3" : (a.mime.split("/")[1] ?? "audio").toUpperCase());
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const secs = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const meta = (a: StudioAudio) => [ext(a), mb(a.size_bytes), secs(a.duration_seconds), when(a.created_at)].filter(Boolean).join(" · ");

async function downloadFile(a: StudioAudio) {
  if (!a.url) return;
  const blob = await (await fetch(a.url)).blob();
  const href = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href, download: `${a.name}.${ext(a).toLowerCase()}` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function StatusBadge({ status }: { status: StudioStatus }) {
  const m = STATUS_META[status];
  return <Badge className={cn("border-transparent", m.tone)}>{m.label}</Badge>;
}

export function StudioLibrary({ items, onChanged }: { items: StudioAudio[]; onChanged: () => void }) {
  const [view, setView] = useState<View>("cards");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<StudioAudio | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY) as View | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after hydration
      if (v && VIEWS.some((x) => x.id === v)) setView(v);
    } catch { /* storage unavailable */ }
  }, []);
  function chooseView(v: View) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ }
  }

  const shown = useMemo(() => items.filter((a) => Boolean(a.archived_at) === archived), [items, archived]);
  const picked = shown.filter((a) => selected.has(a.id));
  const allOn = shown.length > 0 && picked.length === shown.length;
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  function run(act: () => Promise<{ ok?: string; error?: string }>) {
    start(async () => {
      const r = await act();
      setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Done." });
      if (!r.error) { setSelected(new Set()); onChanged(); }
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    let saved = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", "upload");
      const res = await fetch("/api/studio/audio", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { audio?: StudioAudio; error?: string };
      if (data.audio) saved++;
      else setMsg({ text: `${file.name}: ${data.error ?? "upload failed"}`, error: true });
    }
    if (uploadRef.current) uploadRef.current.value = "";
    setUploading(false);
    if (saved) { setMsg({ text: saved === 1 ? "Uploaded." : `Uploaded ${saved} files.` }); onChanged(); }
  }

  const menu = (a: StudioAudio) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`} />}><MoreVertical /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setEditing(a)}><Pencil /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void downloadFile(a)}><Download /> Download</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => archiveStudioAudio([a.id], !a.archived_at))}>{a.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setConfirm([a.id])}><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const check = (a: StudioAudio) => <Checkbox checked={selected.has(a.id)} onCheckedChange={(v) => toggle(a.id, Boolean(v))} aria-label={`Select ${a.name}`} />;
  const player = (a: StudioAudio, compact?: boolean) => (a.url ? <AudioPlayer src={a.url} downloadName={`${a.name}.${ext(a).toLowerCase()}`} compact={compact} /> : <p className="text-xs text-muted-foreground">File unavailable.</p>);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={allOn} onCheckedChange={(v) => setSelected(v ? new Set(shown.map((a) => a.id)) : new Set())} aria-label="Select all" /> All</label>
          <input ref={uploadRef} type="file" accept="audio/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
          <Button onClick={() => uploadRef.current?.click()} disabled={uploading}><Upload /> {uploading ? "Uploading…" : "Upload audio"}</Button>
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
            {[false, true].map((on) => (
              <button key={String(on)} type="button" onClick={() => { setArchived(on); setSelected(new Set()); }}
                className={cn("rounded-md px-2.5 py-1 font-medium", archived === on ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {on ? "Archived" : "Active"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1" role="tablist" aria-label="View">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => chooseView(id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium", view === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{picked.length} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => picked.forEach((a) => void downloadFile(a))}><Download /> Download</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => archiveStudioAudio(picked.map((a) => a.id), !archived))}>
              {archived ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
            </Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirm(picked.map((a) => a.id))}><Trash2 /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {msg && <p role="status" className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.text}</p>}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">{archived ? "Nothing archived." : "No recordings yet."}</p>
          {!archived && <p className="mt-1 text-sm text-muted-foreground">Upload a file, or open the Studio tab to record your voice or make one with an AI voice.</p>}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <div key={a.id} className={cn("space-y-3 rounded-2xl border bg-card p-4", selected.has(a.id) && "border-primary ring-1 ring-primary")}>
              <div className="flex items-start gap-3">
                <span className="pt-2.5">{check(a)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate pt-1.5 font-medium" title={a.name}>{a.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5"><StatusBadge status={a.status} /><Badge variant="outline">{kindLabel(a.kind)}</Badge></div>
                </div>
                <CoverThumb image={a.image} size="lg" />
                {menu(a)}
              </div>
              {player(a)}
              <p className="text-xs text-muted-foreground">{meta(a)}</p>
            </div>
          ))}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {shown.map((a) => (
            <div key={a.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 sm:flex-nowrap", selected.has(a.id) && "border-primary ring-1 ring-primary")}>
              {check(a)}
              <CoverThumb image={a.image} />
              <div className="w-48 min-w-0 shrink-0">
                <p className="truncate text-sm font-medium" title={a.name}>{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">{STATUS_META[a.status].label} · {kindLabel(a.kind)} · {ext(a)} · {mb(a.size_bytes)}</p>
              </div>
              <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">{player(a)}</div>
              {menu(a)}
            </div>
          ))}
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table className="min-w-[44rem]">
            <TableHeader>
              <TableRow><TableHead className="w-10" /><TableHead>Name</TableHead><TableHead>For</TableHead><TableHead>Status</TableHead><TableHead>Length</TableHead><TableHead>Size</TableHead><TableHead>Created</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((a) => (
                <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined}>
                  <TableCell>{check(a)}</TableCell>
                  <TableCell className="max-w-64"><span className="flex items-center gap-2"><CoverThumb image={a.image} size="sm" /><span className="truncate font-medium">{a.name}</span></span></TableCell>
                  <TableCell>{kindLabel(a.kind)}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="tabular-nums">{secs(a.duration_seconds) || "—"}</TableCell>
                  <TableCell className="tabular-nums">{mb(a.size_bytes)}</TableCell>
                  <TableCell>{when(a.created_at)}</TableCell>
                  <TableCell>{menu(a)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : view === "kanban" ? (
        <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
          {STUDIO_STATUSES.map((st) => {
            const col = shown.filter((a) => a.status === st);
            return (
              <div key={st} className="min-w-0 space-y-2 rounded-2xl border bg-muted/30 p-3">
                <p className="flex items-center justify-between px-1 text-sm font-semibold">{STATUS_META[st].label}<span className="text-xs font-normal text-muted-foreground">{col.length}</span></p>
                {col.map((a) => (
                  <div key={a.id} className={cn("space-y-2 rounded-xl border bg-card p-3", selected.has(a.id) && "border-primary ring-1 ring-primary")}>
                    <div className="flex items-center gap-2">{check(a)}<p className="min-w-0 flex-1 truncate text-sm font-medium" title={a.name}>{a.name}</p>{menu(a)}</div>
                    <p className="text-xs text-muted-foreground">{kindLabel(a.kind)} · {secs(a.duration_seconds) || ext(a)}</p>
                    {player(a, true)}
                  </div>
                ))}
                {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nothing here.</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <CalendarView items={shown} onPick={setEditing} />
      )}

      <EditSheet item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        {confirm && (
          <DialogContent title={confirm.length === 1 ? "Delete this recording?" : `Delete ${confirm.length} recordings?`} description="This removes the audio file for good. It can't be undone.">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="destructive" disabled={pending} onClick={() => { const list = confirm; setConfirm(null); run(() => deleteStudioAudio(list)); }}><Trash2 /> Delete</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// A month grid with each recording on the day it was made.
function CalendarView({ items, onPick }: { items: StudioAudio[]; onPick: (a: StudioAudio) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1);
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = new Map<string, StudioAudio[]>();
  items.forEach((a) => { const k = key(new Date(a.created_at)); byDay.set(k, [...(byDay.get(k) ?? []), a]); });
  const today = key(new Date());
  return (
    <div className="rounded-2xl border">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
        <p className="font-semibold">{month.toLocaleString("en-US", { month: "long", year: "numeric" })}</p>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 border-b text-center text-xs text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d} className="py-1.5">{d}</span>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((n, i) => {
          const date = new Date(month.getFullYear(), month.getMonth(), n);
          const list = n >= 1 && n <= days ? byDay.get(key(date)) ?? [] : [];
          return (
            <div key={i} className={cn("min-h-24 space-y-1 border-r border-b p-1.5 text-xs [&:nth-child(7n)]:border-r-0", (n < 1 || n > days) && "bg-muted/30")}>
              {n >= 1 && n <= days && <span className={cn("inline-flex size-6 items-center justify-center rounded-full", key(date) === today && "bg-primary text-primary-foreground")}>{n}</span>}
              {list.slice(0, 3).map((a) => (
                <button key={a.id} type="button" onClick={() => onPick(a)} className="block w-full truncate rounded bg-muted px-1.5 py-0.5 text-left hover:bg-muted/70" title={a.name}>{a.name}</button>
              ))}
              {list.length > 3 && <span className="block px-1 text-muted-foreground">+{list.length - 3} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Edit a recording's name, purpose, status, description and cover.
function EditSheet({ item, onClose, onSaved }: { item: StudioAudio | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Sheet open={Boolean(item)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {item && <EditForm key={item.id} item={item} onSaved={onSaved} />}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({ item, onSaved }: { item: StudioAudio; onSaved: () => void }) {
  const [name, setName] = useState(item.name);
  const [kind, setKind] = useState<StudioKind>(item.kind);
  const [status, setStatus] = useState<StudioStatus>(item.status);
  const [description, setDescription] = useState(item.description ?? "");
  const [image, setImage] = useState<string | null>(item.image);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const imageRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <SheetHeader>
        <SheetTitle>Edit recording</SheetTitle>
        <SheetDescription>{item.source === "ai" && item.ai_provider ? `AI voice · ${item.ai_provider} · ${item.ai_voice ?? ""}` : meta(item)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4">
        {item.url && <AudioPlayer src={item.url} downloadName={item.name} />}
        <div className="flex items-center gap-3">
          <CoverThumb image={image} size="lg" />
          <input ref={imageRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await imageToDataUrl(f)); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" onClick={() => imageRef.current?.click()}><ImagePlus /> {image ? "Replace image" : "Add image"}</Button>
          {image && <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}><X /> Remove</Button>}
        </div>
        <label className="block space-y-1.5"><span className="text-sm font-medium">Name</span><Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5"><span className="text-sm font-medium">What it&apos;s for</span>
            <Pick label="What it's for" value={kind} onChange={(v) => setKind(v as StudioKind)} options={STUDIO_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
          </label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Status</span>
            <Pick label="Status" value={status} onChange={(v) => setStatus(v as StudioStatus)} options={STUDIO_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
          </label>
        </div>
        <label className="block space-y-1.5"><span className="text-sm font-medium">Description</span><Textarea rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <SheetFooter>
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await updateStudioAudio(item.id, { name, kind, status, description, image });
          if (r.error) setError(r.error); else onSaved();
        })}>{pending ? "Saving…" : "Save"}</Button>
      </SheetFooter>
    </>
  );
}
