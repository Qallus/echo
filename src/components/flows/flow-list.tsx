"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2, Workflow } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { prettyNumber } from "@/components/redial/phone-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createFlow, deleteFlow } from "@/lib/flows/actions";
import type { FlowSummary } from "@/lib/flows/data";

// The call tree list in the shared list layout: create one (blank or the sample),
// preview and open it, or delete ones you own.

const lineBadges = (f: FlowSummary) => (
  <span className="flex flex-wrap gap-1.5">
    {f.lines.length
      ? f.lines.map((l) => <Badge key={l.id} variant="outline">{l.label}</Badge>)
      : <Badge variant="outline" className="text-muted-foreground">Not on a line</Badge>}
  </span>
);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function FlowList({ flows }: { flows: FlowSummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState<"blank" | "sample">("sample");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FlowSummary | null>(null);
  const [pending, start] = useTransition();

  const openCreate = () => { setName(""); setError(null); setCreating(true); };

  function create() {
    start(async () => {
      const r = await createFlow(name, from);
      if (r.error || !r.id) { setError(r.error ?? "Couldn't create the call tree."); return; }
      router.push(`/call-tree/${r.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <CollectionView<FlowSummary>
        items={flows} getId={(f) => f.id} title={(f) => f.name} noun={["call tree", "call trees"]} storageKey="call-trees" defaultView="cards"
        empty="No call trees yet. A call tree decides what happens when someone calls: a greeting, a phone menu, business hours, extensions, your AI assistant and voicemail. Use New call tree to make one."
        subtitle={(f) => `Edited ${when(f.updatedAt)}`}
        media={() => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Workflow className="size-4" /></span>}
        badge={(f) => <Badge variant={f.publishedVersion ? "default" : "secondary"}>{f.publishedVersion ? `Published v${f.publishedVersion}` : "Draft"}</Badge>}
        meta={lineBadges}
        searchText={(f) => [f.name, f.description, ...f.lines.map((l) => `${l.label} ${l.number}`)].filter(Boolean).join(" ")}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "published", label: "Published", test: (f) => Boolean(f.publishedVersion) },
          { id: "draft", label: "Draft", test: (f) => !f.publishedVersion },
          { id: "on-line", label: "On a line", test: (f) => f.lines.length > 0 },
          { id: "mine", label: "Mine", test: (f) => f.mine },
        ]}
        date={(f) => f.updatedAt}
        columns={[
          { id: "name", label: "Call tree", sort: (f) => f.name.toLowerCase(), cell: (f) => <span className="flex items-center gap-2 font-medium"><Workflow className="size-4 text-muted-foreground" />{f.name}</span> },
          { id: "status", label: "Status", sort: (f) => f.publishedVersion ?? 0, cell: (f) => <Badge variant={f.publishedVersion ? "default" : "secondary"}>{f.publishedVersion ? `Published v${f.publishedVersion}` : "Draft"}</Badge> },
          { id: "lines", label: "Lines", sort: (f) => f.lines.length, cell: lineBadges },
          { id: "updated", label: "Edited", sort: (f) => f.updatedAt, cell: (f) => <span className="text-muted-foreground">{when(f.updatedAt)}</span> },
        ]}
        toolbar={<Button onClick={openCreate}><Plus /> New call tree</Button>}
        actions={[
          { label: "Open", icon: ExternalLink, single: true, run: ([f]) => router.push(`/call-tree/${f.id}`) },
          { label: "Delete", icon: Trash2, destructive: true, show: (rows) => rows.every((f) => f.mine), run: (rows) => {
            if (rows.length === 1) { setRemoving(rows[0]); return; }
            if (!confirm(`Delete ${rows.length} call trees? Their versions and call history are removed for good. Lines they ran on go back to how they answered before.`)) return;
            start(async () => {
              for (const f of rows) { const r = await deleteFlow(f.id); if (r.error) { setError(r.error); break; } }
              router.refresh();
            });
          } },
        ]}
        previewActions={(f) => (
          <>
            <Button size="sm" nativeButton={false} render={<Link href={`/call-tree/${f.id}`} />}><ExternalLink /> Open in Call Tree</Button>
            {f.mine && <Button size="sm" variant="outline" onClick={() => setRemoving(f)}><Trash2 /> Delete</Button>}
          </>
        )}
        preview={(f) => (
          <div className="space-y-4 text-sm">
            {f.description && <p className="whitespace-pre-wrap text-muted-foreground">{f.description}</p>}
            <dl className="divide-y rounded-xl border px-3">
              {([["Status", f.publishedVersion ? `Published, version ${f.publishedVersion}` : "Draft, not published yet"], ["Edited", when(f.updatedAt)], ["Owner", f.mine ? "You" : "Shared with you"]] as const).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Lines it answers</p>
              {f.lines.length ? (
                <ul className="divide-y rounded-xl border">
                  {f.lines.map((l) => <li key={l.id} className="flex justify-between gap-2 px-3 py-2"><span>{l.label}</span><span className="text-muted-foreground tabular-nums">{prettyNumber(l.number)}</span></li>)}
                </ul>
              ) : <p className="text-muted-foreground">Not on a line yet. Pick it for a line in the line&apos;s settings.</p>}
            </div>
          </div>
        )}
      />
      {error && !creating && <p className="text-sm text-destructive">{error}</p>}

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
