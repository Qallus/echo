"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Minus, Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildFlowWithAi } from "@/lib/flows/ai";
import { BLOCKS, type Flow, type Issue } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";

// Build with AI: describe the call tree (or a change), see what would be
// added, changed and removed, then apply it to the draft.

const EXAMPLES = [
  "During business hours, greet callers and offer 1 for sales and 2 for service. After hours, let the AI assistant answer.",
  "Add a holiday message for December 25 that sends callers to voicemail.",
  "Let callers press 0 at the main menu to reach the operator, and make every menu repeat once if nobody answers.",
];

type Preview = { flow: Flow; issues: Issue[]; model?: string };

export function AiBuilder({ flow, onApply }: { flow: Flow; onApply: (f: Flow) => void }) {
  const [ask, setAsk] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const before = new Map(flow.nodes.map((n) => [n.id, n]));
  const after = new Map((preview?.flow.nodes ?? []).map((n) => [n.id, n]));
  const added = preview ? preview.flow.nodes.filter((n) => !before.has(n.id)) : [];
  const removed = preview ? flow.nodes.filter((n) => !after.has(n.id)) : [];
  const changed = preview ? preview.flow.nodes.filter((n) => {
    const o = before.get(n.id);
    return o && JSON.stringify({ ...o, pos: 0 }) !== JSON.stringify({ ...n, pos: 0 });
  }) : [];
  const errors = preview?.issues.filter((i) => i.level === "error") ?? [];

  return (
    <div className="h-full overflow-y-auto bg-muted/40 p-4 pt-16">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="space-y-2 rounded-2xl border bg-background p-4">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" /> Build with AI</p>
          <p className="text-sm text-muted-foreground">Describe what callers should hear and where calls should go, or what to change. You&apos;ll see a preview before anything changes.</p>
          <Textarea rows={4} maxLength={2000} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={EXAMPLES[0]} aria-label="Describe the call tree" />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setAsk(e)} className="rounded-full border px-2.5 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{e.length > 60 ? `${e.slice(0, 60)}…` : e}</button>)}
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={pending || ask.trim().length < 5} onClick={() => start(async () => {
              setError(null);
              const r = await buildFlowWithAi(ask, flow);
              if (r.error || !r.flow) { setPreview(null); setError(r.error ?? "Something went wrong."); return; }
              setPreview({ flow: r.flow, issues: r.issues ?? [], model: r.model });
            })}><Sparkles /> {pending ? "Building…" : "Build"}</Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        {preview && (
          <div className="space-y-3 rounded-2xl border bg-background p-4">
            <p className="font-semibold">Preview{preview.model ? <span className="font-normal text-muted-foreground"> · {preview.model}</span> : null}</p>
            {added.length + changed.length + removed.length === 0 ? <p className="text-sm text-muted-foreground">No changes.</p> : (
              <ul className="space-y-1.5 text-sm">
                {added.map((n) => <Row key={`a${n.id}`} kind="added" label={n.label || BLOCKS[n.type].label} type={BLOCKS[n.type].label} />)}
                {changed.map((n) => <Row key={`c${n.id}`} kind="changed" label={n.label || BLOCKS[n.type].label} type={BLOCKS[n.type].label} />)}
                {removed.map((n) => <Row key={`r${n.id}`} kind="removed" label={n.label || BLOCKS[n.type].label} type={BLOCKS[n.type].label} />)}
              </ul>
            )}
            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="size-3.5 text-destructive" /> Needs your input before publishing</p>
                <ul className="list-disc space-y-0.5 pl-5">{errors.slice(0, 6).map((e, i) => <li key={i}>{e.message}</li>)}</ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => { onApply(preview.flow); setPreview(null); setAsk(""); }}>Apply to draft</Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
            </div>
            <p className="text-xs text-muted-foreground">Applying changes the draft only. Calls keep following the published version until you publish.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ kind, label, type }: { kind: "added" | "changed" | "removed"; label: string; type: string }) {
  const Icon = kind === "added" ? Plus : kind === "removed" ? Minus : Pencil;
  return (
    <li className="flex items-center gap-2">
      <span className={cn("flex size-5 items-center justify-center rounded-md", kind === "removed" ? "bg-destructive/10 text-destructive" : "bg-muted")}><Icon className="size-3" /></span>
      <span className="font-medium">{label}</span><span className="text-xs text-muted-foreground">{type} · {kind}</span>
    </li>
  );
}
