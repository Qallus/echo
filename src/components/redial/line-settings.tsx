"use client";

import { useState, useTransition } from "react";
import { Ban, Star, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addListEntry, removeListEntry, saveLine, type LineSettings } from "@/lib/redial/actions";
import { defaultGreeting } from "@/lib/redial/assistant";
import { MODES, VOICES, decide, normalizeNumber as toE164, type Line, type ListEntry, type ListKind } from "@/lib/redial/types";
import { cn } from "@/lib/utils";

const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30";
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const KIND = { allow: { label: "Allow", icon: UserCheck }, vip: { label: "VIP", icon: Star }, block: { label: "Block", icon: Ban } } as const;

export type LineForm = ReturnType<typeof useLineForm>;

// One settings draft shared by the Rules and Assistant tabs.
export function useLineForm(line: Line) {
  const [s, setS] = useState<LineSettings>({
    label: line.label, forward_to: line.forward_to ? pretty(line.forward_to) : "", mode: line.mode, paused: line.paused, allow_connect: line.allow_connect,
    assistant_name: line.assistant_name, voice: line.voice, greeting: line.greeting ?? "", about: line.about ?? "", max_seconds: line.max_seconds,
  });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const set = (patch: Partial<LineSettings>) => { setS((x) => ({ ...x, ...patch })); setMsg({}); };
  const save = () => start(async () => setMsg(await saveLine(line.id, s)));
  return { s, set, save, msg, pending };
}

function SaveBar({ form }: { form: LineForm }) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={form.save} disabled={form.pending}>{form.pending ? "Saving…" : "Save"}</Button>
      {(form.msg.ok || form.msg.error) && <p className={form.msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{form.msg.error ?? form.msg.ok}</p>}
    </div>
  );
}

export function RulesSettings({ line, form, entries }: { line: Line; form: LineForm; entries: ListEntry[] }) {
  const { s, set } = form;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Screening</h2>
          <div className="space-y-2" role="radiogroup" aria-label="Screening mode">
            {MODES.map((m) => (
              <label key={m.id} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", s.mode === m.id && "border-primary bg-primary/5")}>
                <input type="radio" name="mode" className="mt-1" checked={s.mode === m.id} onChange={() => set({ mode: m.id })} />
                <span><span className="block text-sm font-medium">{m.label}</span><span className="block text-xs text-muted-foreground">{m.detail}</span></span>
              </label>
            ))}
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span><span className="block text-sm font-medium">Pause screening</span><span className="block text-xs text-muted-foreground">Calls ring straight through to your phone until you turn this off.</span></span>
            <Switch checked={s.paused} onCheckedChange={(paused) => set({ paused })} />
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Putting calls through</h2>
          <div className="space-y-1.5">
            <Label htmlFor="rd-forward">Ring this number</Label>
            <Input id="rd-forward" type="tel" placeholder="(480) 555-0142" value={s.forward_to} onChange={(e) => set({ forward_to: e.target.value })} className="max-w-xs" />
            <p className="text-xs text-muted-foreground">Usually your cell. It shows {pretty(line.number)} as the caller, and you press 1 to take the call. It can&apos;t be a phone that forwards back to {pretty(line.number)}.</p>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <span><span className="block text-sm font-medium">Let my assistant put important calls through</span><span className="block text-xs text-muted-foreground">Family, expected calls and urgent matters. Otherwise it always takes a message.</span></span>
            <Switch checked={s.allow_connect} onCheckedChange={(allow_connect) => set({ allow_connect })} />
          </label>
        </section>
        <SaveBar form={form} />

        <Lists line={line} entries={entries} />
      </div>
      <Simulator form={form} entries={entries} />
    </div>
  );
}

function Lists({ line, entries }: { line: Line; entries: ListEntry[] }) {
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ListKind>("allow");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Allow, VIP and block lists</h2>
        <p className="text-sm text-muted-foreground">Allowed numbers skip screening when you screen unknown callers. VIPs always ring through. Blocked numbers are rejected.</p>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
        e.preventDefault();
        start(async () => { const r = await addListEntry(line.id, number, kind, label); setMsg(r); if (r.ok) { setNumber(""); setLabel(""); } });
      }}>
        <div className="space-y-1"><Label htmlFor="rd-num" className="text-xs">Number</Label><Input id="rd-num" type="tel" className="h-9 w-40" value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="rd-lbl" className="text-xs">Name (optional)</Label><Input id="rd-lbl" className="h-9 w-40" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="rd-kind" className="text-xs">List</Label>
          <select id="rd-kind" className={`${SELECT} w-28`} value={kind} onChange={(e) => setKind(e.target.value as ListKind)}>
            <option value="allow">Allow</option><option value="vip">VIP</option><option value="block">Block</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>Add</Button>
      </form>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {entries.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {entries.map((e) => {
            const K = KIND[e.kind];
            return (
              <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                <K.icon className={cn("size-4 shrink-0", e.kind === "block" ? "text-destructive" : "text-muted-foreground")} aria-label={K.label} />
                <span className="min-w-0 flex-1"><span className="font-medium">{e.label || pretty(e.number)}</span>{e.label && <span className="text-muted-foreground"> · {pretty(e.number)}</span>}</span>
                <span className="text-xs text-muted-foreground">{K.label}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.label || e.number}`} disabled={pending} onClick={() => start(async () => setMsg(await removeListEntry(e.id)))}><Trash2 /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// "What happens if this number calls?" Uses the same decide() as live calls,
// with the unsaved settings.
function Simulator({ form, entries }: { form: LineForm; entries: ListEntry[] }) {
  const [number, setNumber] = useState("");
  const [hidden, setHidden] = useState(false);
  const from = hidden ? null : toE164(number);
  const forward = form.s.forward_to.trim() ? toE164(form.s.forward_to) : null;
  const d = decide({ mode: form.s.mode, paused: form.s.paused, forward_to: forward }, from, entries);
  const outcome = { block: "Rejected (blocked)", forward: "Rings your phone", screen: "Your assistant answers and screens", voicemail: "Goes to voicemail" }[d.action];
  return (
    <aside className="h-fit space-y-3 rounded-xl border bg-card p-4 lg:sticky lg:top-4">
      <h2 className="font-semibold">Try a call</h2>
      <p className="text-xs text-muted-foreground">See what happens with your current (unsaved) settings.</p>
      <Input type="tel" placeholder="Caller's number" value={number} disabled={hidden} onChange={(e) => setNumber(e.target.value)} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> No caller ID</label>
      {(hidden || from) ? (
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">{outcome}</p>
          <p className="text-xs text-muted-foreground">{d.reason}</p>
          {d.action === "screen" && form.s.allow_connect && forward && <p className="mt-1 text-xs text-muted-foreground">If it sounds important, your assistant can put it through to {pretty(forward)}.</p>}
        </div>
      ) : number && <p className="text-xs text-muted-foreground">Enter a full phone number.</p>}
    </aside>
  );
}

export function AssistantSettings({ line, form, ownerFirst }: { line: Line; form: LineForm; ownerFirst: string }) {
  const { s, set } = form;
  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="rd-name">Assistant&apos;s name</Label><Input id="rd-name" maxLength={40} value={s.assistant_name} onChange={(e) => set({ assistant_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="rd-voice">Voice</Label>
          <select id="rd-voice" className={SELECT} value={s.voice} onChange={(e) => set({ voice: e.target.value })}>
            {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.detail}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rd-greeting">Greeting</Label>
        <Textarea id="rd-greeting" rows={3} maxLength={500} value={s.greeting} placeholder={defaultGreeting({ assistant_name: s.assistant_name || line.assistant_name }, ownerFirst)} onChange={(e) => set({ greeting: e.target.value })} />
        <p className="text-xs text-muted-foreground">The first thing callers hear. Leave blank for the default above. Your assistant always says it&apos;s an AI if asked.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rd-about">What your assistant should know</Label>
        <Textarea id="rd-about" rows={6} maxLength={4000} value={s.about} onChange={(e) => set({ about: e.target.value })}
          placeholder={"e.g. I run a roofing company. Always put through calls about active jobs or storm damage. I'm not interested in solar, insurance or marketing offers. My wife is Sarah."} />
        <p className="text-xs text-muted-foreground">Used only to decide what&apos;s important. Your assistant won&apos;t share it with callers.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rd-max">Longest screening call</Label>
        <select id="rd-max" className={`${SELECT} max-w-xs`} value={s.max_seconds} onChange={(e) => set({ max_seconds: Number(e.target.value) })}>
          {[60, 90, 120, 180, 240, 300].map((n) => <option key={n} value={n}>{n < 120 ? `${n} seconds` : `${n / 60} minutes`}</option>)}
        </select>
      </div>
      <SaveBar form={form} />
    </div>
  );
}
