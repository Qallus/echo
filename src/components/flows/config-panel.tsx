"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { BlockIcon } from "@/components/flows/block-icon";
import { FORMS } from "@/components/flows/block-forms";
import { outLabel } from "@/components/flows/flow-node";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DESCRIPTIONS } from "@/lib/flows/blocks";
import { BLOCKS, outputsOf, type Flow, type FlowNode, type Issue } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";

// The right panel: the selected block's label, settings and where each output
// goes; with nothing selected, the flow's own settings. The main blocks have
// forms (block-forms.tsx); the rest are edited as JSON.

const SELECT = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ConfigPanel({ flow, selected, issues, onChange, onSelect }: {
  flow: Flow; selected: FlowNode | null; issues: Issue[];
  onChange: (update: (f: Flow) => Flow) => void; onSelect: (id: string | null) => void;
}) {
  if (!selected) return <FlowSettings flow={flow} issues={issues} onChange={onChange} onSelect={onSelect} />;
  return <BlockSettings key={selected.id} flow={flow} node={selected} issues={issues.filter((i) => i.node === selected.id)} onChange={onChange} onSelect={onSelect} />;
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Configuration</p>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function IssueList({ issues, onSelect }: { issues: Issue[]; onSelect?: (id: string | null) => void }) {
  if (!issues.length) return null;
  return (
    <ul className="space-y-1.5">
      {issues.map((i, k) => (
        <li key={k}>
          <button type="button" disabled={!onSelect || !i.node} onClick={() => i.node && onSelect?.(i.node)}
            className={cn("flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-xs", i.level === "error" ? "border-destructive/40 bg-destructive/5" : "bg-muted/40", onSelect && i.node && "hover:bg-muted")}>
            <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", i.level === "error" ? "text-destructive" : "text-amber-500")} />
            <span>{i.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FlowSettings({ flow, issues, onChange, onSelect }: { flow: Flow; issues: Issue[]; onChange: (u: (f: Flow) => Flow) => void; onSelect: (id: string | null) => void }) {
  const set = (patch: Partial<Flow["settings"]>) => onChange((f) => ({ ...f, settings: { ...f.settings, ...patch } }));
  return (
    <div className="space-y-5 p-4">
      <Heading title="Call tree settings" sub="Select a block on the canvas to change it." />
      <label className="block space-y-1.5"><span className="text-sm font-medium">Name</span>
        <Input value={flow.name} maxLength={80} onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))} />
      </label>
      <label className="block space-y-1.5"><span className="text-sm font-medium">Time zone</span>
        <Input value={flow.settings.timezone} maxLength={60} onChange={(e) => set({ timezone: e.target.value })} placeholder="America/Phoenix" />
      </label>
      <label className="block space-y-1.5"><span className="text-sm font-medium">Record calls</span>
        <select className={SELECT} value={flow.settings.recording} onChange={(e) => set({ recording: e.target.value as Flow["settings"]["recording"] })}>
          <option value="off">Off</option>
          <option value="after_connect">After the caller is connected to someone</option>
          <option value="all">The whole call</option>
        </select>
      </label>
      <label className="block space-y-1.5"><span className="text-sm font-medium">When an output isn&apos;t connected</span>
        <select className={SELECT} value={flow.settings.onUnconnected} onChange={(e) => set({ onUnconnected: e.target.value as Flow["settings"]["onUnconnected"] })}>
          <option value="ai_or_voicemail">Your AI assistant answers (voicemail if out of minutes)</option>
          <option value="voicemail">Voicemail</option>
          <option value="goodbye">Say goodbye and hang up</option>
        </select>
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Checks</p>
        {issues.length ? <IssueList issues={issues} onSelect={onSelect} /> : <p className="text-sm text-muted-foreground">No problems found.</p>}
      </div>
    </div>
  );
}

function BlockSettings({ flow, node, issues, onChange, onSelect }: {
  flow: Flow; node: FlowNode; issues: Issue[]; onChange: (u: (f: Flow) => Flow) => void; onSelect: (id: string | null) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(node.config, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const update = (patch: (n: FlowNode) => FlowNode) => onChange((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === node.id ? patch(n) : n)) }));
  const isStart = node.id === flow.start;
  const others = flow.nodes.filter((n) => n.id !== node.id && n.id !== flow.start);

  // New settings; connections from outputs the block no longer has are dropped.
  const setConfig = (config: Record<string, unknown>) => update((n) => {
    const outs = outputsOf({ ...n, config });
    return { ...n, config, next: Object.fromEntries(Object.entries(n.next).filter(([out]) => outs.includes(out))) };
  });
  const Form = FORMS[node.type];

  function applyJson() {
    try {
      const value = JSON.parse(json) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings must be a JSON object.");
      setConfig(value as Record<string, unknown>);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><BlockIcon type={node.type} className="size-4" /></span>
        <Heading title={BLOCKS[node.type].label} sub={DESCRIPTIONS[node.type]} />
      </div>
      <label className="block space-y-1.5"><span className="text-sm font-medium">Block label</span>
        <Input value={node.label} maxLength={80} onChange={(e) => update((n) => ({ ...n, label: e.target.value }))} />
      </label>

      {!isStart && Form && <Form config={node.config} onChange={setConfig} />}

      {!isStart && !Form && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Settings</span>
          <Textarea rows={10} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs" aria-label="Block settings (JSON)" />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <Button size="sm" variant="outline" onClick={applyJson}>Apply settings</Button>
        </div>
      )}

      {outputsOf(node).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Where each output goes</p>
          {outputsOf(node).map((out) => (
            <label key={out} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
              <span className="truncate text-muted-foreground" title={outLabel(node, out)}>{outLabel(node, out)}</span>
              <select className={SELECT} value={node.next[out] ?? ""} onChange={(e) => update((n) => {
                const next = { ...n.next };
                if (e.target.value) next[out] = e.target.value; else delete next[out];
                return { ...n, next };
              })}>
                <option value="">Not connected</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.label || BLOCKS[o.type].label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      {issues.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">Checks</p><IssueList issues={issues} /></div>}

      {!isStart && (
        <Button variant="destructive" size="sm" onClick={() => {
          onChange((f) => ({ ...f, nodes: f.nodes.filter((n) => n.id !== node.id).map((n) => ({ ...n, next: Object.fromEntries(Object.entries(n.next).filter(([, to]) => to !== node.id)) })) }));
          onSelect(null);
        }}><Trash2 /> Delete block</Button>
      )}
    </div>
  );
}
