"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, Loader2, Plus, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LocalDate } from "@/components/local-date";
import {
  AREA_LABEL, AREAS, KINDS, label, PRIORITIES, SOURCE_LABEL, STATUS_LABEL, STATUSES, type Status,
} from "@/lib/backlog";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addComment, createRequest, deleteRequest, getRequestDetail, updateRequest, type BacklogState, type RequestDetail,
} from "./actions";

const pick = "w-auto";

export function NewItemForm({ workspaces }: { workspaces: Workspace[] }) {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [round, setRound] = useState(0); // remounts the dropdowns on reset so they return to their defaults
  const [state, action, pending] = useActionState<BacklogState, FormData>(async (prev, data) => {
    const res = await createRequest(prev, data);
    if (res.ok) form.current?.reset(); // ready for the next item
    return res;
  }, {});

  if (!open) return <Button onClick={() => setOpen(true)}><Plus /> New item</Button>;
  return (
    <form ref={form} action={action} onReset={() => setRound((n) => n + 1)} className="w-full space-y-2 rounded-lg border p-3">
      <Input name="title" placeholder="What needs doing?" maxLength={200} required autoFocus />
      <Textarea name="details" placeholder="Details (optional)" rows={3} maxLength={20000} />
      <div key={round} className="flex flex-wrap items-center gap-2">
        <Pick name="kind" defaultValue="feature" className={pick} label="Kind" options={KINDS.map((k) => ({ value: k, label: label(k) }))} />
        <Pick name="area" defaultValue="dashboard" className={pick} label="Area" options={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))} />
        <Pick name="priority" defaultValue="normal" className={pick} label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: label(p) }))} />
        <Pick name="workspace_id" defaultValue={workspaces.find((w) => w.isPersonal)?.id} className={pick} label="Workspace"
          options={workspaces.map((w) => ({ value: w.id, label: w.isPersonal ? "Personal" : w.name }))} />
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add item"}</Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-muted-foreground">Added. Add another, or close.</p>}
    </form>
  );
}

// Filters live in the URL (?status=&area=&priority=&workspace=) so views can be bookmarked.
export function Filters({ workspaces }: { workspaces: Workspace[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Pick className={pick} label="Status" value={params.get("status") ?? ""} onChange={(v) => set("status", v)}
        options={[{ value: "", label: "Open items" }, { value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
      <Pick className={pick} label="Area" value={params.get("area") ?? ""} onChange={(v) => set("area", v)}
        options={[{ value: "", label: "All areas" }, ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))]} />
      <Pick className={pick} label="Priority" value={params.get("priority") ?? ""} onChange={(v) => set("priority", v)}
        options={[{ value: "", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p, label: label(p) }))]} />
      {workspaces.length > 1 && (
        <Pick className={pick} label="Workspace" value={params.get("workspace") ?? ""} onChange={(v) => set("workspace", v)}
          options={[{ value: "", label: "All workspaces" }, ...workspaces.map((w) => ({ value: w.id, label: w.isPersonal ? "Personal" : w.name }))]} />
      )}
    </div>
  );
}

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Pick size="sm" className={cn(pick, "text-xs", pending && "opacity-60")} label="Status" value={value} disabled={pending}
        onChange={(v) => {
          const next = v as Status;
          setValue(next);
          start(async () => { const res = await updateRequest(id, { status: next }); if (res.error) setValue(status); });
        }}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
    </span>
  );
}

export const priorityClass: Record<string, string> = {
  urgent: "border-destructive/50 text-destructive", high: "border-amber-500/50 text-amber-600", normal: "", low: "text-muted-foreground",
};

// Detail drawer, opened by ?item=<id>.
export function ItemDrawer({ itemId, spaces }: { itemId: string | null; spaces: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    getRequestDetail(itemId).then((d) => { if (!cancelled) { setDetail(d); setLoadedId(itemId); } });
    return () => { cancelled = true; };
  }, [itemId]);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("item");
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const reload = async () => { if (itemId) setDetail(await getRequestDetail(itemId)); };
  const loading = Boolean(itemId) && loadedId !== itemId;

  return (
    <Sheet open={Boolean(itemId)} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {loading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>
        ) : !detail ? (
          <SheetHeader><SheetTitle>Item not found</SheetTitle><SheetDescription>It may have been deleted.</SheetDescription></SheetHeader>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-base">{detail.title}</SheetTitle>
              <SheetDescription>
                {spaces[detail.workspace_id] ?? "Workspace"} · added via {SOURCE_LABEL[detail.source] ?? detail.source} · <LocalDate iso={detail.created_at} short />
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                <StatusSelect key={`${detail.id}-${detail.status}`} id={detail.id} status={detail.status as Status} />
                <Badge variant="outline">{label(detail.kind)}</Badge>
                <Badge variant="outline">{AREA_LABEL[detail.area as keyof typeof AREA_LABEL] ?? detail.area}</Badge>
                <Badge variant="outline" className={priorityClass[detail.priority]}>{label(detail.priority)}</Badge>
              </div>
              {detail.details
                ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.details}</p>
                : <p className="text-sm text-muted-foreground">No details.</p>}

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Comments</h3>
                {detail.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3 text-sm">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {c.author_label ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
                      {c.author_label ?? (c.mine ? "You" : "Teammate")} · <LocalDate iso={c.created_at} short />
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
                {!detail.comments.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
                <form className="space-y-2" onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const res = await addComment(detail.id, comment);
                    setError(res.error);
                    if (!res.error) { setComment(""); await reload(); }
                  });
                }}>
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" rows={2} maxLength={20000} />
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={pending}
                      onClick={() => start(async () => { const res = await deleteRequest(detail.id); if (res.error) setError(res.error); else close(); })}>
                      <Trash2 /> Delete item
                    </Button>
                    <Button type="submit" size="sm" disabled={pending || !comment.trim()}>Comment</Button>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </form>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
