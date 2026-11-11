"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Trash2, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createFlow, deleteFlow } from "@/lib/flows/actions";
import type { FlowSummary } from "@/lib/flows/data";

// The call tree list: create one (blank or the sample), open it, or delete one you own.

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function FlowList({ flows }: { flows: FlowSummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState<"blank" | "sample">("sample");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FlowSummary | null>(null);
  const [pending, start] = useTransition();

  function create() {
    start(async () => {
      const r = await createFlow(name, from);
      if (r.error || !r.id) { setError(r.error ?? "Couldn't create the call tree."); return; }
      router.push(`/call-tree/${r.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setName(""); setError(null); setCreating(true); }}><Plus /> New call tree</Button>
      </div>

      {flows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Workflow className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No call trees yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">A call tree decides what happens when someone calls: a greeting, a phone menu, business hours, extensions, your AI assistant and voicemail.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}><Plus /> Create your first call tree</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {flows.map((f) => (
            <div key={f.id} className="flex flex-col rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Workflow className="size-4" /></span>
                <Link href={`/call-tree/${f.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.name}</p>
                  <p className="text-xs text-muted-foreground">Edited {when(f.updatedAt)}</p>
                </Link>
                {f.mine && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${f.name}`} />}><MoreVertical /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onClick={() => setRemoving(f)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant={f.publishedVersion ? "default" : "secondary"}>{f.publishedVersion ? `Published v${f.publishedVersion}` : "Draft"}</Badge>
                {f.lines.length
                  ? f.lines.map((l) => <Badge key={l.id} variant="outline">{l.label}</Badge>)
                  : <Badge variant="outline" className="text-muted-foreground">Not on a line</Badge>}
              </div>
              <Button variant="outline" size="sm" className="mt-4 self-start" nativeButton={false} render={<Link href={`/call-tree/${f.id}`} />}>Open in Call Tree</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && (
          <DialogContent title="New call tree" description="Name it after the line or what it's for, like Main business line or After hours.">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Main business line" aria-label="Call tree name" />
              <div className="grid gap-2" role="radiogroup" aria-label="Start from">
                {([
                  ["sample", "Sample business line", "Business hours, a greeting, a menu for sales, support and the operator, your AI assistant and voicemail."],
                  ["blank", "Blank", "A greeting and goodbye to build on."],
                ] as const).map(([v, title, desc]) => (
                  <button key={v} type="button" role="radio" aria-checked={from === v} onClick={() => setFrom(v)}
                    className={`rounded-lg border p-3 text-left transition-colors ${from === v ? "border-foreground bg-muted/50" : "hover:bg-muted/40"}`}>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
                <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create and open"}</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        {removing && (
          <DialogContent title={`Delete "${removing.name}"?`} description="The call tree, its versions and its call history are removed for good. Lines it ran on go back to how they answered before.">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
                const r = await deleteFlow(removing.id);
                setRemoving(null);
                if (r.error) setError(r.error); else router.refresh();
              })}><Trash2 /> Delete</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
