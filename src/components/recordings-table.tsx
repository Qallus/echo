"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  ArchiveRestore, ArrowRightLeft, Briefcase, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Columns3, Download, Folder,
  FolderMinus, LayoutGrid, List, Loader2, Lock, Monitor, Phone, Rows3, Trash2, Upload, Video, X,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocalDate } from "@/components/local-date";
import { exportRecordings, fileRecordings, moveRecordings, trashRecordings, type BulkResult } from "@/lib/actions";
import { RECORDINGS_MIME } from "@/lib/dnd";
import { formatDuration, spaceLabel } from "@/lib/format";
import { SOURCES, type Folder as FolderT, type Recording, type Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const sourceIcon = { phone_call: Phone, meeting: Video, upload: Upload, desktop: Monitor };
const typeLabel = (r: Recording) => SOURCES[r.source].label.replace(/s$/, "");

type View = "list" | "table" | "kanban" | "calendar" | "cards";
const VIEWS: { id: View; label: string; icon: typeof List }[] = [
  { id: "list", label: "List", icon: List }, { id: "table", label: "Table", icon: Rows3 }, { id: "kanban", label: "Kanban", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays }, { id: "cards", label: "Cards", icon: LayoutGrid },
];
const COLUMNS: { label: string; match: (s: Recording["status"]) => boolean }[] = [
  { label: "Processing", match: (s) => s === "processing" }, { label: "Ready", match: (s) => s === "generated" },
  { label: "Failed", match: (s) => s === "failed" }, { label: "Not transcribed", match: (s) => !["processing", "generated", "failed"].includes(s) },
];

// The chosen view, remembered in this browser.
const VIEW_KEY = "echo:recordings-view";
const viewListeners = new Set<() => void>();
function useStoredView(): [View, (v: View) => void] {
  const view = useSyncExternalStore(
    (cb) => { viewListeners.add(cb); return () => { viewListeners.delete(cb); }; },
    () => { try { const v = localStorage.getItem(VIEW_KEY); return VIEWS.some((x) => x.id === v) ? (v as View) : "table"; } catch { return "table"; } },
    () => "table" as View,
  );
  return [view, (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } viewListeners.forEach((cb) => cb()); }];
}

// Month calendar of recordings by the day they were made.
function MonthGrid({ rows, renderItem }: { rows: Recording[]; renderItem: (r: Recording) => React.ReactNode }) {
  const [month, setMonth] = useState(() => { const d = new Date(rows[0]?.createdAt ?? Date.now()); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = new Map<string, Recording[]>();
  for (const r of rows) { const k = key(new Date(r.createdAt)); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const today = key(new Date());
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-medium">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[42rem] grid-cols-7 overflow-hidden rounded-xl border text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="border-b bg-muted/50 px-2 py-1.5 font-medium text-muted-foreground">{d}</div>)}
          {days.map((d, i) => {
            const list = byDay.get(key(d)) ?? [];
            return (
              <div key={key(d)} className={cn("min-h-24 border-b p-1", i % 7 && "border-l", d.getMonth() !== month.getMonth() && "bg-muted/30 text-muted-foreground")}>
                <span className={cn("mb-1 inline-grid size-6 place-items-center rounded-full", key(d) === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                <div className="space-y-0.5">{list.slice(0, 4).map(renderItem)}{list.length > 4 && <p className="px-1 text-[11px] text-muted-foreground">+{list.length - 4} more</p>}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StatusTag({ status }: { status: Recording["status"] }) {
  if (status === "generated")
    return <span className="inline-flex items-center gap-1 text-xs text-sky-600"><CircleCheck className="size-3.5" /> Generated</span>;
  if (status === "processing")
    return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Loader2 className="size-3.5 animate-spin" /> Processing</span>;
  if (status === "failed")
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><CircleAlert className="size-3.5" /> Failed</span>;
  return null;
}

type Props = {
  rows: Recording[];
  workspaces: Workspace[];
  folders: FolderT[];
  emptyText?: string;
  /** Rows can come from several workspaces: show each row's Business/Personal badge. */
  showSpace?: boolean;
  /** Trash view: offer Restore instead of Move to Trash. */
  trash?: boolean;
};

export function RecordingsTable({ rows, workspaces, folders, emptyText = "Nothing here yet", showSpace, trash }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [pending, start] = useTransition();

  // Drop ids that left this view (moved, trashed) after a refresh.
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));
  const allChecked = rows.length > 0 && ids.length === rows.length;

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const run = (label: string, action: () => Promise<BulkResult>) =>
    start(async () => {
      const res = await action();
      setSelected(new Set());
      const ok = res.done ? `${label} ${res.done} recording${res.done === 1 ? "" : "s"}.` : "";
      setNotice(res.errors.length ? { text: [ok, ...res.errors].filter(Boolean).join(" "), error: true } : { text: ok });
    });

  const download = () =>
    start(async () => {
      const { filename, text } = await exportRecordings(ids);
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
      URL.revokeObjectURL(url);
    });

  const [view, setView] = useStoredView();
  const space = (r: Recording) => (showSpace ? workspaces.find((w) => w.id === r.workspaceId) : undefined);
  // Dragging a selected item carries the whole selection onto a folder.
  const drag = (r: Recording, className?: string) => trash ? { className } : {
    draggable: true,
    className: cn("cursor-grab active:cursor-grabbing", className),
    onDragStart: (e: React.DragEvent) => {
      const dragged = selected.has(r.id) ? ids : [r.id];
      e.dataTransfer.setData(RECORDINGS_MIME, JSON.stringify(dragged));
      e.dataTransfer.setData("text/plain", `${dragged.length} recording${dragged.length === 1 ? "" : "s"}`);
      e.dataTransfer.effectAllowed = "move";
    },
  };
  const pick = (r: Recording, small?: boolean) => (
    <Checkbox aria-label={`Select ${r.title}`} className={small ? "size-3.5" : undefined} checked={selected.has(r.id)} onCheckedChange={(v) => toggle(r.id, !!v)} />
  );
  const card = (r: Recording, compact?: boolean) => {
    const Icon = sourceIcon[r.source];
    const ws = space(r);
    return (
      <div key={r.id} {...drag(r, cn("relative rounded-xl border bg-card p-3 transition hover:shadow-sm", selected.has(r.id) && "ring-2 ring-primary"))}>
        <div className="absolute top-3 right-3">{pick(r)}</div>
        <Link href={`/recordings/${r.id}`} draggable={false} className="block space-y-2 pr-7">
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" />{typeLabel(r)}</span>
          <span className={cn("line-clamp-2 block font-medium", compact && "text-sm")}>{r.title}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <LocalDate iso={r.createdAt} short /><span>{formatDuration(r.durationSec)}</span>{!compact && <StatusTag status={r.status} />}
          </span>
          {ws && <Badge variant="outline" className="text-muted-foreground">{ws.isPersonal ? <Lock /> : <Briefcase />} {spaceLabel(ws)}</Badge>}
        </Link>
      </div>
    );
  };

  if (!rows.length)
    return <div className="py-24 text-center text-sm text-muted-foreground">{emptyText}</div>;

  return (
    <div className="space-y-3">
      {ids.length > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-lg border bg-background/95 px-2 py-1.5 text-sm shadow-sm backdrop-blur">
          <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setSelected(new Set())}><X /></Button>
          <span className="mr-2 font-medium">{ids.length} selected</span>

          {!trash && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
                  <ArrowRightLeft /> Move to
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {workspaces.map((w) => (
                    <DropdownMenuItem key={w.id} onClick={() => run("Moved", () => moveRecordings(ids, w.id))}>
                      {w.isPersonal ? <Lock /> : <Briefcase />}
                      <span className="truncate">{w.isPersonal ? "Personal (only you)" : `${w.name} (team)`}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
                  <Folder /> Folder
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {workspaces.map((w) => {
                    const list = folders.filter((f) => f.workspaceId === w.id);
                    if (!list.length) return null;
                    return (
                      <DropdownMenuGroup key={w.id}>
                        <DropdownMenuLabel>{spaceLabel(w)}</DropdownMenuLabel>
                        {list.map((f) => (
                          <DropdownMenuItem key={f.id} onClick={() => run("Filed", () => fileRecordings(ids, f.id))}>
                            <Folder /> <span className="truncate">{f.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    );
                  })}
                  {folders.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => run("Unfiled", () => fileRecordings(ids, null))}>
                    <FolderMinus /> Remove from folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button variant="outline" size="sm" disabled={pending} onClick={download}><Download /> Export</Button>
          {trash ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run("Restored", () => trashRecordings(ids, false))}>
              <ArchiveRestore /> Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run("Moved to Trash", () => trashRecordings(ids, true))}>
              <Trash2 /> Move to Trash
            </Button>
          )}
          {pending && <Loader2 className="ml-1 size-4 animate-spin text-muted-foreground" />}
        </div>
      ) : (
        notice && (
          <p className={cn("text-sm", notice.error ? "text-destructive" : "text-muted-foreground")}>{notice.text}</p>
        )
      )}

      <div className="flex justify-end">
        <div role="tablist" aria-label="View" className="flex items-center rounded-lg border bg-card p-0.5">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} title={label} onClick={() => setView(id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", view === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-3.5" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === "table" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox aria-label="Select all" checked={allChecked} indeterminate={ids.length > 0 && !allChecked}
                  onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden w-32 md:table-cell">Type</TableHead>
              <TableHead className="hidden w-28 md:table-cell">Status</TableHead>
              <TableHead className="w-16 sm:w-28">Duration</TableHead>
              <TableHead className="hidden w-48 sm:table-cell">Date created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const Icon = sourceIcon[r.source];
              const ws = space(r);
              return (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined} {...drag(r)}>
                  <TableCell>{pick(r)}</TableCell>
                  <TableCell className="py-3">
                    <Link href={`/recordings/${r.id}`} draggable={false} className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 space-y-1">
                        <span className="block max-w-[55vw] truncate font-medium sm:max-w-xl">{r.title}</span>
                        <span className="block text-xs text-muted-foreground sm:hidden"><LocalDate iso={r.createdAt} /></span>
                        <span className="flex flex-wrap items-center gap-2 md:hidden"><StatusTag status={r.status} /></span>
                        {ws && <Badge variant="outline" className="text-muted-foreground">{ws.isPersonal ? <Lock /> : <Briefcase />} {spaceLabel(ws)}</Badge>}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{typeLabel(r)}</TableCell>
                  <TableCell className="hidden md:table-cell"><StatusTag status={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDuration(r.durationSec)}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell"><LocalDate iso={r.createdAt} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {view === "list" && (
        <ul className="divide-y rounded-xl border">
          <li className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
            <Checkbox aria-label="Select all" checked={allChecked} indeterminate={ids.length > 0 && !allChecked}
              onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />
            {rows.length} recording{rows.length === 1 ? "" : "s"}
          </li>
          {rows.map((r) => {
            const Icon = sourceIcon[r.source];
            return (
              <li key={r.id} {...drag(r, cn("flex items-center gap-3 px-3 py-2", selected.has(r.id) && "bg-muted/60"))}>
                {pick(r)}
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <Link href={`/recordings/${r.id}`} draggable={false} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{r.title}</Link>
                <StatusTag status={r.status} />
                <span className="hidden w-20 text-right text-xs text-muted-foreground tabular-nums sm:block">{formatDuration(r.durationSec)}</span>
                <span className="hidden w-28 text-right text-xs text-muted-foreground md:block"><LocalDate iso={r.createdAt} short /></span>
              </li>
            );
          })}
        </ul>
      )}

      {view === "cards" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => card(r))}
        </div>
      )}

      {view === "kanban" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = rows.filter((r) => col.match(r.status));
            return (
              <div key={col.label} className="flex min-h-40 flex-col gap-2 rounded-xl bg-muted/50 p-2">
                <p className="flex items-center justify-between px-1 text-sm font-medium">{col.label}<span className="text-xs text-muted-foreground">{list.length}</span></p>
                {list.map((r) => card(r, true))}
              </div>
            );
          })}
        </div>
      )}

      {view === "calendar" && <MonthGrid rows={rows} renderItem={(r) => (
        <div key={r.id} className={cn("flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-muted", selected.has(r.id) && "bg-accent")}>
          {pick(r, true)}
          <Link href={`/recordings/${r.id}`} className="min-w-0 flex-1 truncate">{r.title}</Link>
        </div>
      )} />}
    </div>
  );
}
