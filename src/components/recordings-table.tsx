"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArchiveRestore, ArrowRightLeft, Briefcase, CircleAlert, CircleCheck, Download, Folder, FolderMinus, Loader2, Lock,
  Monitor, Phone, Trash2, Upload, Video, X,
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
import type { Folder as FolderT, Recording, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const sourceIcon = { phone_call: Phone, meeting: Video, upload: Upload, desktop: Monitor };

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox aria-label="Select all" checked={allChecked} indeterminate={ids.length > 0 && !allChecked}
                onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-16 sm:w-28">Duration</TableHead>
            <TableHead className="hidden w-48 sm:table-cell">Date created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const Icon = sourceIcon[r.source];
            const ws = showSpace ? workspaces.find((w) => w.id === r.workspaceId) : undefined;
            const isSelected = selected.has(r.id);
            return (
              <TableRow key={r.id} data-state={isSelected ? "selected" : undefined} draggable={!trash}
                className={cn(!trash && "cursor-grab active:cursor-grabbing")}
                onDragStart={(e) => {
                  // Dragging a selected row carries the whole selection.
                  const dragged = isSelected ? ids : [r.id];
                  e.dataTransfer.setData(RECORDINGS_MIME, JSON.stringify(dragged));
                  e.dataTransfer.setData("text/plain", `${dragged.length} recording${dragged.length === 1 ? "" : "s"}`);
                  e.dataTransfer.effectAllowed = "move";
                }}>
                <TableCell>
                  <Checkbox aria-label={`Select ${r.title}`} checked={isSelected} onCheckedChange={(v) => toggle(r.id, !!v)} />
                </TableCell>
                <TableCell className="py-3">
                  <Link href={`/recordings/${r.id}`} draggable={false} className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 space-y-1">
                      <span className="block max-w-[55vw] truncate font-medium sm:max-w-xl">{r.title}</span>
                      {/* Phones: the date column is hidden, so show it here. */}
                      <span className="block text-xs text-muted-foreground sm:hidden"><LocalDate iso={r.createdAt} /></span>
                      <span className="flex flex-wrap items-center gap-2">
                        {ws && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {ws.isPersonal ? <Lock /> : <Briefcase />} {spaceLabel(ws)}
                          </Badge>
                        )}
                        <StatusTag status={r.status} />
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDuration(r.durationSec)}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell"><LocalDate iso={r.createdAt} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
