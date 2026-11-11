"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import { AlertTriangle, ArrowLeft, Braces, CheckCircle2, Download, Hash, History, MoreHorizontal, PhoneIncoming, Rocket, Sparkles, Upload, Workflow } from "lucide-react";
import { AiBuilder } from "@/components/flows/ai-builder";
import { BlockLibrary } from "@/components/flows/block-library";
import { BuilderProvider } from "@/components/flows/builder-context";
import { ExtensionsSheet } from "@/components/flows/extensions-sheet";
import { PublishDialog } from "@/components/flows/publish-dialog";
import { VersionsSheet } from "@/components/flows/versions-sheet";
import { CallsSheet } from "@/components/flows/calls-sheet";
import { ConfigPanel } from "@/components/flows/config-panel";
import { FlowCanvas } from "@/components/flows/flow-canvas";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import { saveFlowDraft } from "@/lib/flows/actions";
import { layoutFlow, newNode, starterFlow } from "@/lib/flows/blocks";
import type { BuilderContext, FlowDraft, FlowRun } from "@/lib/flows/data";
import { BLOCKS, flowSchema, validateFlow, type BlockType, type Flow } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";

// Call Tree: block library, canvas and settings for one flow. The draft
// saves itself a moment after each change; a copy is kept in this browser
// until the save goes through, so a lost connection doesn't lose work.

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
type Tab = "visual" | "ai" | "json";
const backupKey = (id: string) => `flow-draft:${id}`;
// Drag to resize the library and settings columns (same look as the email editor).
const HANDLE = "w-1.5 bg-border transition-colors hover:bg-foreground/20 data-[separator=active]:bg-foreground/30";

function readDraft(d: FlowDraft): Flow {
  const parsed = flowSchema.safeParse(d.draft);
  return parsed.success ? parsed.data : starterFlow(d.name);
}

export function FlowStudio({ initial, context }: { initial: FlowDraft; context: BuilderContext }) {
  const [flow, setFlow] = useState<Flow>(() => readDraft(initial));
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("visual");
  const [save, setSave] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(() => new Date(initial.updatedAt));
  const [restore, setRestore] = useState<Flow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);
  const [run, setRun] = useState<FlowRun | null>(null);
  // The path a picked call took: the blocks it visited and the links between them.
  const path = useMemo(() => {
    if (!run) return null;
    const nodes = new Set(run.steps.map((s) => s.node));
    const edges = new Set(run.steps.flatMap((s, i) => {
      const next = run.steps[i + 1];
      return s.transition && next ? [`${s.node}:${s.transition}`] : [];
    }));
    return { nodes, edges };
  }, [run]);
  const rev = useRef(initial.rev);
  const latest = useRef(flow);
  // Saves run one at a time, so each uses the revision the last one returned.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const importRef = useRef<HTMLInputElement>(null);

  const { issues } = useMemo(() => validateFlow(flow), [flow]);
  const errors = issues.filter((i) => i.level === "error").length;
  const selectedNode = flow.nodes.find((n) => n.id === selected) ?? null;
  const published = useMemo(() => { const p = flowSchema.safeParse(initial.published); return p.success ? JSON.stringify(p.data) : null; }, [initial.published]);
  const changed = published !== null && published !== JSON.stringify(flow);

  // Unsaved work from an earlier visit, made on this same revision.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey(initial.id));
      const b = raw ? (JSON.parse(raw) as { rev: number; flow: unknown }) : null;
      const parsed = b && b.rev === initial.rev ? flowSchema.safeParse(b.flow) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- offering a local copy found after load
      if (parsed?.success && JSON.stringify(parsed.data) !== JSON.stringify(readDraft(initial))) setRestore(parsed.data);
      else if (raw) localStorage.removeItem(backupKey(initial.id));
    } catch { /* storage unavailable */ }
  }, [initial]);

  const change = useCallback((update: (f: Flow) => Flow) => {
    setFlow((f) => {
      const next = update(f);
      latest.current = next;
      try { localStorage.setItem(backupKey(initial.id), JSON.stringify({ rev: rev.current, flow: next })); } catch { /* storage unavailable */ }
      return next;
    });
    setSave((s) => (s === "conflict" ? s : "dirty"));
  }, [initial.id]);

  // Autosave a moment after the last change.
  useEffect(() => {
    if (save !== "dirty") return;
    const t = window.setTimeout(() => { queue.current = queue.current.then(async () => {
      setSave("saving");
      const sent = latest.current;
      const r = await saveFlowDraft(initial.id, sent, rev.current).catch(() => ({ error: "offline" }) as const);
      if ("conflict" in r && r.conflict) { setSave("conflict"); return; }
      if ("error" in r && r.error) { setSave("error"); return; }
      if ("rev" in r && typeof r.rev === "number") rev.current = r.rev;
      setSavedAt(new Date());
      if (latest.current === sent) {
        try { localStorage.removeItem(backupKey(initial.id)); } catch { /* storage unavailable */ }
        setSave("saved");
      } else setSave("dirty");
    }); }, 1200);
    return () => window.clearTimeout(t);
  }, [save, flow, initial.id]);

  // After a failed save, try again every few seconds.
  useEffect(() => {
    if (save !== "error") return;
    const t = window.setTimeout(() => setSave("dirty"), 5000);
    return () => window.clearTimeout(t);
  }, [save]);

  const addBlock = useCallback((type: BlockType, pos?: [number, number]) => {
    const below = flow.nodes.find((n) => n.id === selected) ?? flow.nodes[flow.nodes.length - 1];
    const node = newNode(type, flow.nodes.map((n) => n.id), pos ?? [below.pos[0], below.pos[1] + 180]);
    change((f) => ({ ...f, nodes: [...f.nodes, node] }));
    setSelected(node.id);
    if (!pos) setFocus(node.id);
  }, [flow.nodes, selected, change]);

  function exportJson() {
    const href = URL.createObjectURL(new Blob([JSON.stringify(flow, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href, download: `${flow.name.replace(/[^\w-]+/g, "-").toLowerCase() || "flow"}.json` });
    a.click();
    URL.revokeObjectURL(href);
  }

  async function importJson(file: File | null) {
    if (!file) return;
    try {
      const parsed = flowSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "That file isn't a Redial call tree.");
      change(() => parsed.data);
      setSelected(null);
      setNotice(`Imported "${parsed.data.name}". Your previous version is replaced; export first if you want to keep it.`);
    } catch (e) {
      setNotice(`Couldn't import that file: ${(e as Error).message}`);
    }
    if (importRef.current) importRef.current.value = "";
  }

  const status = save === "saving" ? "Saving…" : save === "dirty" ? "Unsaved changes" : save === "error" ? "Couldn't save. Retrying…"
    : save === "conflict" ? "Someone else changed this call tree" : `Saved · ${savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  return (
    <BuilderProvider value={context}>
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/call-tree" aria-label="All call trees" />}><ArrowLeft /></Button>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Calls / Call Tree · {initial.publishedVersion ? `Live: version ${initial.publishedVersion}${changed ? " · draft has unpublished changes" : ""}` : "Not published yet"}</p>
          <p className="truncate font-semibold">{flow.name || "Untitled call tree"}</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-xs", save === "error" || save === "conflict" ? "border-destructive/40 text-destructive" : "text-muted-foreground")} aria-live="polite">{status}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              {issues.length ? <AlertTriangle className={errors ? "text-destructive" : "text-amber-500"} /> : <CheckCircle2 />}
              {issues.length ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"}` : "No issues"}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              {issues.length ? (
                <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                  {issues.map((i, k) => (
                    <li key={k}><button type="button" onClick={() => i.node && setSelected(i.node)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                      <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", i.level === "error" ? "text-destructive" : "text-amber-500")} />{i.message}
                    </button></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No problems found.</p>}
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setExtOpen(true)}><Hash /> Extensions</Button>
          <Button variant="outline" size="sm" onClick={() => setCallsOpen(true)}><PhoneIncoming /> Calls</Button>
          <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}><History /> Versions</Button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importJson(e.target.files?.[0] ?? null)} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="More" />}><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => change((f) => layoutFlow(f))}><Workflow /> Tidy up layout</DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}><Upload /> Import JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={exportJson}><Download /> Export JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setPublishOpen(true)}><Rocket /> Publish</Button>
        </div>
      </header>

      {(restore || notice || save === "conflict") && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-muted/50 px-4 py-2 text-sm">
          {save === "conflict" ? (
            <><span>Someone else saved this call tree while you were editing. Reload to see their version; your changes stay in this browser until you do.</span>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button></>
          ) : restore ? (
            <><span>You have unsaved changes from an earlier visit.</span>
              <Button size="sm" onClick={() => { change(() => restore); setRestore(null); }}>Restore them</Button>
              <Button size="sm" variant="ghost" onClick={() => { try { localStorage.removeItem(backupKey(initial.id)); } catch { /* storage unavailable */ } setRestore(null); }}>Discard</Button></>
          ) : (
            <><span>{notice}</span><Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button></>
          )}
        </div>
      )}

      <ResizablePanelGroup className="min-h-0 flex-1">
        <ResizablePanel defaultSize={240} minSize={180} maxSize={420} className="min-h-0">
          <BlockLibrary onAdd={(t) => addBlock(t)} />
        </ResizablePanel>
        <ResizableHandle withHandle className={HANDLE} />
        <ResizablePanel minSize={360} className="relative min-h-0">
          <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-lg border bg-background p-1 shadow-sm" role="tablist" aria-label="Editor">
            {([["visual", "Visual builder", Workflow], ["ai", "Build with AI", Sparkles], ["json", "JSON", Braces]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", tab === id ? "bg-muted" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          {tab === "visual" ? (
            <ReactFlowProvider>
              <FlowCanvas flow={flow} issues={issues} selected={selected} focus={focus} path={path} onSelect={setSelected} onChange={change} onDropBlock={(t, p) => addBlock(t, p)} />
            </ReactFlowProvider>
          ) : tab === "ai" ? (
            <AiBuilder flow={flow} onApply={(f) => { change(() => f); setSelected(null); setTab("visual"); }} />
          ) : (
            <JsonEditor key={JSON.stringify(flow).length} flow={flow} onApply={(f) => { change(() => f); setTab("visual"); }} />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle className={HANDLE} />
        <ResizablePanel defaultSize={320} minSize={260} maxSize={560} className="min-h-0 overflow-y-auto">
          <ConfigPanel flow={flow} selected={selectedNode} issues={issues} onChange={change} onSelect={setSelected} />
        </ResizablePanel>
      </ResizablePanelGroup>
      <ExtensionsSheet open={extOpen} onOpenChange={setExtOpen} />
      <CallsSheet open={callsOpen} onOpenChange={setCallsOpen} flowId={initial.id} flow={flow} picked={run?.id ?? null} onPick={(r) => { setRun(r); if (r) setCallsOpen(false); }} />
      {run && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-20 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-background px-4 py-2 text-sm shadow-lg">
            Showing the path of a call from {run.from ?? "an unknown caller"}
            <Button size="sm" variant="ghost" onClick={() => setRun(null)}>Clear</Button>
          </div>
        </div>
      )}
      <VersionsSheet open={versionsOpen} onOpenChange={setVersionsOpen} flowId={initial.id} versions={initial.versions} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} flowId={initial.id} issues={issues} saved={save === "saved"}
        lineIds={initial.lineIds} nextVersion={(initial.versions[0]?.version ?? 0) + 1} />
    </div>
    </BuilderProvider>
  );
}

// The whole flow as JSON, for copying, pasting and bulk edits.
function JsonEditor({ flow, onApply }: { flow: Flow; onApply: (f: Flow) => void }) {
  const [text, setText] = useState(() => JSON.stringify(flow, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex h-full flex-col gap-3 bg-muted/40 p-4 pt-16">
      <Textarea spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} className="min-h-0 flex-1 resize-none bg-background font-mono text-xs" aria-label="Flow JSON" />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => {
          try {
            const parsed = flowSchema.safeParse(JSON.parse(text));
            if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
            setError(null);
            onApply(parsed.data);
          } catch (e) { setError((e as Error).message); }
        }}>Apply JSON</Button>
        <span className="text-xs text-muted-foreground">{flow.nodes.length} blocks · {Object.keys(BLOCKS).length} block types available</span>
        {error && <p className="w-full text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
