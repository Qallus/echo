"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Copy, KeyRound, Pause, Play, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createAgent, decideApproval, pauseAllAgents, removeAgent, rotateAgentKey, setAgentActive, updateAgent, type AgentSettings } from "@/lib/admin/actions/agents";
import { AGENT_AREAS, HARNESSES, areasFor, domainsFor } from "@/lib/mcp/agent-areas";
import { cn } from "@/lib/utils";

export type AgentRow = {
  id: string; name: string; harness: string; key_hint: string | null; permissions: string[]; read_only: boolean; domains: string[];
  approval_tools: string[]; caps: { writes?: number; high?: number }; ip_allowlist: string[]; active: boolean; expires_at: string | null;
  created_at: string; key_rotated_at: string; calls_24h: number; failed_24h: number; last_call_at: string | null;
};
export type ApprovalRow = { id: string; agent_id: string; tool: string; args: Record<string, unknown>; summary: string | null; status: string; expires_at: string; created_at: string; decided_at: string | null };
type Msg = { ok?: string; error?: string; key?: string };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const harness = (id: string) => HARNESSES.find((h) => h.id === id)?.label ?? id;

export function AgentsView({ agents, approvals, myPermissions, mcpUrl }: { agents: AgentRow[]; approvals: ApprovalRow[]; myPermissions: string[]; mcpUrl: string }) {
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();
  const name = new Map(agents.map((a) => [a.id, a.name]));
  const waiting = approvals.filter((x) => x.status === "pending" && new Date(x.expires_at) > new Date());

  return (
    <div className="space-y-6">
      {msg.key && <KeyBox keyText={msg.key} mcpUrl={mcpUrl} onDone={() => setMsg({})} />}
      {(msg.ok || msg.error) && !msg.key && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}

      {waiting.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium"><ShieldAlert className="size-4" /> Waiting for your approval</p>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {waiting.map((x) => (
              <li key={x.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{name.get(x.agent_id) ?? "Agent"} <span className="font-normal text-muted-foreground">· {x.tool} · {when(x.created_at)}</span></p>
                  <p className="break-words">{x.summary}</p>
                  <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Exact request</summary><pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{JSON.stringify(x.args, null, 2)}</pre></details>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setMsg(await decideApproval(x.id, false)))}><X /> Decline</Button>
                  <Button size="sm" disabled={pending} onClick={() => start(async () => setMsg(await decideApproval(x.id, true)))}><Check /> Approve</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAdding((v) => !v)}><Plus /> New agent</Button>
        {agents.some((a) => a.active) && (
          <Button variant="outline" disabled={pending} onClick={() => confirm("Pause every agent now? Their keys stop working until you resume them.") && start(async () => setMsg(await pauseAllAgents()))}><Pause /> Pause all agents</Button>
        )}
      </div>
      {adding && <AgentForm myPermissions={myPermissions} onSave={(s) => start(async () => { const r = await createAgent(s); setMsg(r); if (!r.error) setAdding(false); })} pending={pending} />}

      {agents.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No agents yet. Make one for each harness (Paperclip, Hermes, OpenClaw, Herdr) so each has its own key and limits.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {agents.map((a) => <AgentItem key={a.id} agent={a} myPermissions={myPermissions} history={approvals.filter((x) => x.agent_id === a.id)} onMsg={setMsg} />)}
        </ul>
      )}
    </div>
  );
}

function AgentItem({ agent: a, myPermissions, history, onMsg }: { agent: AgentRow; myPermissions: string[]; history: ApprovalRow[]; onMsg: (m: Msg) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const expired = a.expires_at && new Date(a.expires_at) <= new Date();
  const run = (f: () => Promise<Msg>) => start(async () => onMsg(await f()));
  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Bot className="size-5 shrink-0 text-muted-foreground" />
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <span className="font-medium">{a.name}</span> <span className="text-muted-foreground">· {harness(a.harness)} · {a.key_hint}</span>
          <span className="block text-xs text-muted-foreground">
            {a.read_only ? "Read only" : `${a.permissions.length} permissions`} · {a.domains.length ? `${areasFor(a.domains).length} areas` : "all areas"} · {a.caps.writes ?? 500} changes/day · {a.calls_24h} calls today{a.failed_24h ? ` (${a.failed_24h} failed)` : ""}{a.last_call_at ? ` · last ${when(a.last_call_at)}` : ""}
          </span>
        </button>
        <Badge variant="outline" className={cn(!a.active || expired ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>{!a.active ? "Paused" : expired ? "Expired" : "Active"}</Badge>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setAgentActive(a.id, !a.active))}>{a.active ? <><Pause /> Pause</> : <><Play /> Resume</>}</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(`Make a new key for ${a.name}? The old one stops working right away.`) && run(() => rotateAgentKey(a.id))}><KeyRound /> New key</Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${a.name}`} disabled={pending} onClick={() => confirm(`Remove ${a.name}? Its key stops working and it can't be undone.`) && run(() => removeAgent(a.id))}><Trash2 /></Button>
      </div>
      {open && (
        <div className="mt-3 space-y-4 border-t pt-3">
          <AgentForm initial={a} myPermissions={myPermissions} pending={pending} onSave={(s) => run(() => updateAgent(a.id, s))} />
          {history.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Recent approval requests</p>
              <ul className="space-y-1 text-xs">{history.slice(0, 8).map((x) => <li key={x.id} className="flex gap-2"><span className="w-20 shrink-0 text-muted-foreground">{x.status}</span><span className="truncate">{x.summary}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function AgentForm({ initial, myPermissions, onSave, pending }: { initial?: AgentRow; myPermissions: string[]; onSave: (s: AgentSettings) => void; pending: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [harnessId, setHarness] = useState(initial?.harness ?? "paperclip");
  const [perms, setPerms] = useState<string[]>(initial?.permissions ?? myPermissions.filter((p) => p !== "staff.manage"));
  const [readOnly, setReadOnly] = useState(initial?.read_only ?? false);
  const [areas, setAreas] = useState<string[]>(initial ? areasFor(initial.domains) : []);
  const [writes, setWrites] = useState(String(initial?.caps.writes ?? 500));
  const [high, setHigh] = useState(String(initial?.caps.high ?? 20));
  const [ask, setAsk] = useState((initial?.approval_tools ?? []).join(", "));
  const [ips, setIps] = useState((initial?.ip_allowlist ?? []).join("\n"));
  const [expires, setExpires] = useState(initial?.expires_at?.slice(0, 10) ?? "");
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form className="space-y-4 rounded-xl border p-4" onSubmit={(e) => {
      e.preventDefault();
      onSave({
        name, harness: harnessId, permissions: perms, read_only: readOnly, domains: domainsFor(areas), approval_tools: ask.split(/[\s,]+/),
        caps: { writes: Number(writes), high: Number(high) }, ip_allowlist: ips.split(/\s+/), expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor={`an-${initial?.id ?? "new"}`}>Name</Label><Input id={`an-${initial?.id ?? "new"}`} maxLength={80} required placeholder="e.g. Paperclip sales agent" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Runs on</Label>
          <select value={harnessId} onChange={(e) => setHarness(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm">{HARNESSES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Permissions</Label>
          <span className="flex gap-2 text-xs">
            <button type="button" className="underline" onClick={() => setPerms(myPermissions)}>Everything I can do</button>
            <button type="button" className="underline" onClick={() => setPerms(myPermissions.filter((p) => p.endsWith(".view")))}>View only</button>
            <button type="button" className="underline" onClick={() => setPerms([])}>None</button>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {myPermissions.map((p) => (
            <button key={p} type="button" onClick={() => setPerms(toggle(perms, p))}
              className={cn("rounded-full border px-2.5 py-1 text-xs", perms.includes(p) ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>{p}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Staff permissions for admin data. Every agent can also use its own account&apos;s records, like any user.</p>
      </div>

      <div className="space-y-2">
        <Label>Areas</Label>
        <div className="flex flex-wrap gap-1.5">
          {AGENT_AREAS.map((x) => (
            <button key={x.id} type="button" onClick={() => setAreas(toggle(areas, x.id))}
              className={cn("rounded-full border px-2.5 py-1 text-xs", areas.includes(x.id) ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>{x.label}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{areas.length ? "Only these areas." : "None picked: every area its permissions allow."}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm sm:col-span-3">
          <span><span className="block font-medium">Read only</span><span className="block text-xs text-muted-foreground">It can look things up but never change anything.</span></span>
          <Switch checked={readOnly} onCheckedChange={setReadOnly} />
        </label>
        <div className="space-y-1.5"><Label>Changes per 24 hours</Label><Input type="number" min={0} value={writes} onChange={(e) => setWrites(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>High-risk actions per 24 hours</Label><Input type="number" min={0} value={high} onChange={(e) => setHigh(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Key expires</Label><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
      </div>

      <div className="space-y-1.5">
        <Label>Always ask me before these tools <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input placeholder="e.g. resource_create, resource_update" value={ask} onChange={(e) => setAsk(e.target.value)} />
        <p className="text-xs text-muted-foreground">High-risk actions (deletes, sends, money, access) always wait for your approval. Add any other tool names here.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Only from these IP addresses <span className="font-normal text-muted-foreground">(optional, one per line)</span></Label>
        <Textarea rows={2} placeholder="e.g. your Coolify server's address" value={ips} onChange={(e) => setIps(e.target.value)} />
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={pending || !name.trim()}>{initial ? "Save" : "Create agent and key"}</Button></div>
    </form>
  );
}

// The new key, shown once, with what to paste into the harness.
function KeyBox({ keyText, mcpUrl, onDone }: { keyText: string; mcpUrl: string; onDone: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (label: string, text: string) => { void navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 1500); };
  const config = JSON.stringify({ mcpServers: { redial: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${keyText}` } } } }, null, 2);
  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
      <p className="font-medium">Copy this key now. It won&apos;t be shown again.</p>
      <div className="flex gap-2"><code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5">{keyText}</code><Button size="sm" variant="outline" onClick={() => copy("key", keyText)}><Copy /> {copied === "key" ? "Copied" : "Copy"}</Button></div>
      <p className="text-muted-foreground">In the agent&apos;s harness, add an MCP server at <code>{mcpUrl}</code> with the header <code>Authorization: Bearer &lt;key&gt;</code>. For example:</p>
      <pre className="overflow-auto rounded bg-muted p-2 text-xs">{config}</pre>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => copy("config", config)}><Copy /> {copied === "config" ? "Copied" : "Copy config"}</Button><Button size="sm" onClick={onDone}>Done</Button></div>
    </div>
  );
}
