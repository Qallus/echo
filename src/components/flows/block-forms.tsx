"use client";

import Link from "next/link";
import { ExternalLink, Plus, X } from "lucide-react";
import { useBuilder } from "@/components/flows/builder-context";
import { AudioPlayer } from "@/components/studio/audio-player";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BlockType } from "@/lib/flows/schema";
import { kindLabel } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

// Settings forms for the main Call Tree blocks. Each form edits the block's
// `config` object; blocks without a form here are edited as JSON.

type Config = Record<string, unknown>;
type FormProps = { config: Config; onChange: (c: Config) => void };
type Prompt = { audioId?: string; text?: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-md border bg-muted/40 p-0.5" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("flex-1 rounded px-2 py-1 text-xs font-medium", value === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
      ))}
    </div>
  );
}

const num = (v: string, min: number, max: number, fallback: number) => Math.max(min, Math.min(max, Math.round(Number(v)) || fallback));

// What the caller hears: a Recording Studio clip, or text read aloud.
export function PromptField({ label, value, onChange, optional }: { label: string; value: Prompt | undefined; onChange: (p: Prompt | undefined) => void; optional?: boolean }) {
  const { recordings } = useBuilder();
  const mode = value?.audioId !== undefined ? "audio" : "text";
  const clip = recordings.find((r) => r.id === value?.audioId);
  const sorted = [...recordings].sort((a, b) => Number(!["greeting", "ivr", "extension"].includes(a.kind)) - Number(!["greeting", "ivr", "extension"].includes(b.kind)));
  return (
    <Field label={label}>
      {optional && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Play something first</span>
          <Switch checked={Boolean(value)} onCheckedChange={(on) => onChange(on ? { text: "" } : undefined)} />
        </label>
      )}
      {(!optional || value) && (
        <div className="space-y-2">
          <Seg value={mode} options={[["text", "Read aloud"], ["audio", "Recording"]]} onChange={(m) => onChange(m === "audio" ? { audioId: sorted[0]?.id ?? "" } : { text: "" })} />
          {mode === "text" ? (
            <Textarea rows={3} maxLength={1000} value={value?.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Thanks for calling. For sales, press 1." />
          ) : recordings.length ? (
            <>
              <Pick label="Recording" value={value?.audioId ?? ""} onChange={(v) => onChange({ audioId: v })}
                options={[...(!clip ? [{ value: "", label: "Choose a recording" }] : []), ...sorted.map((r) => ({ value: r.id, label: `${r.name} · ${kindLabel(r.kind)}` }))]} />
              {clip?.url && <AudioPlayer src={clip.url} downloadName={clip.name} compact />}
            </>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No recordings yet. Make one in the Recording Studio, then pick it here.</p>
          )}
          <Link href="/studio?tab=studio" target="_blank" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Open the Recording Studio <ExternalLink className="size-3" />
          </Link>
        </div>
      )}
    </Field>
  );
}

function SayForm({ config, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <PromptField label="What callers hear" value={config.prompt as Prompt} onChange={(p) => onChange({ ...config, prompt: p })} />
      <Field label="Play it">
        <Pick label="Play it" value={String(config.loop ?? 1)} onChange={(v) => onChange({ ...config, loop: Number(v) })}
          options={[1, 2, 3].map((n) => ({ value: String(n), label: n === 1 ? "Once" : `${n} times` }))} />
      </Field>
    </div>
  );
}

type Option = { out: string; key?: string; speech?: string[] };
function GatherForm({ config, onChange }: FormProps) {
  const options = (config.options as Option[]) ?? [];
  const input = (config.input as string[]) ?? ["dtmf"];
  const speech = input.includes("speech");
  const setOptions = (o: Option[]) => onChange({ ...config, options: o });
  const freshOut = () => { for (let i = options.length + 1; ; i++) if (!options.some((o) => o.out === `option_${i}`)) return `option_${i}`; };
  const freeKey = KEYS.find((k) => !options.some((o) => o.key === k));
  return (
    <div className="space-y-4">
      <PromptField label="Menu prompt" value={config.prompt as Prompt} onChange={(p) => onChange({ ...config, prompt: p })} />
      <Field label="Callers can">
        <Seg value={speech ? (input.includes("dtmf") ? "both" : "speech") : "dtmf"} options={[["dtmf", "Press keys"], ["speech", "Speak"], ["both", "Either"]]}
          onChange={(v) => onChange({ ...config, input: v === "both" ? ["dtmf", "speech"] : [v] })} />
      </Field>
      <Field label="Options" hint={speech ? "Spoken words are matched with Twilio speech recognition. Separate words with commas." : undefined}>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={o.out} className="flex items-start gap-2">
              {input.includes("dtmf") && (
                <Pick label="Key" className="w-16 shrink-0" value={o.key ?? ""} onChange={(v) => setOptions(options.map((x, k) => (k === i ? { ...x, key: v || undefined } : x)))}
                  options={[{ value: "", label: "–" }, ...KEYS.map((k) => ({ value: k, label: k, disabled: k !== o.key && options.some((x) => x.key === k) }))]} />
              )}
              {speech && (
                <Input aria-label="Spoken words" placeholder="sales, buy" value={(o.speech ?? []).join(", ")}
                  onChange={(e) => setOptions(options.map((x, k) => (k === i ? { ...x, speech: e.target.value.split(",").map((w) => w.trim()).filter(Boolean).slice(0, 10) } : x)))} />
              )}
              <span className="flex-1 truncate pt-2 text-xs text-muted-foreground" title={o.out}>{o.out.replace(/_/g, " ")}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Remove option" onClick={() => setOptions(options.filter((_, k) => k !== i))}><X /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" disabled={options.length >= 12} onClick={() => setOptions([...options, { out: freshOut(), key: input.includes("dtmf") ? freeKey : undefined, speech: speech ? [] : undefined }])}><Plus /> Add option</Button>
        </div>
      </Field>
      <Field label="Wait for an answer">
        <Pick label="Wait for an answer" value={String(config.timeout ?? 5)} onChange={(v) => onChange({ ...config, timeout: Number(v) })}
          options={[3, 5, 8, 10, 15].map((s) => ({ value: String(s), label: `${s} seconds` }))} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span><span className="block text-sm font-medium">Dial an extension at any time</span><span className="block text-xs text-muted-foreground">Callers can type an extension (like 101) instead of choosing an option.</span></span>
        <Switch checked={Boolean(config.extensions)} onCheckedChange={(v) => onChange({ ...config, extensions: v })} />
      </label>
    </div>
  );
}

const VARIABLES = [
  ["trigger.call.from", "Caller's number"], ["trigger.call.callerName", "Caller ID name"], ["trigger.call.city", "Caller's city"],
  ["trigger.call.to", "Number they called"],
] as const;
const OPS = [["equals", "is"], ["contains", "contains"], ["matches", "matches pattern"], ["gt", "is more than"], ["lt", "is less than"], ["empty", "is empty"]] as const;
type Rule = { out: string; variable: string; op: string; value: string };
function SplitForm({ config, onChange }: FormProps) {
  const rules = (config.rules as Rule[]) ?? [];
  const set = (r: Rule[]) => onChange({ ...config, rules: r });
  const freshOut = () => { for (let i = rules.length + 1; ; i++) if (!rules.some((r) => r.out === `rule_${i}`)) return `rule_${i}`; };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Rules are checked in order. The first that matches decides where the call goes; otherwise it takes &ldquo;No match&rdquo;.</p>
      {rules.map((r, i) => (
        <div key={r.out} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Rule {i + 1}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Remove rule" disabled={rules.length === 1} onClick={() => set(rules.filter((_, k) => k !== i))}><X /></Button></div>
          <Input list="flow-variables" aria-label="Value to check" value={r.variable} onChange={(e) => set(rules.map((x, k) => (k === i ? { ...x, variable: e.target.value } : x)))} />
          <Pick label="Comparison" value={r.op} onChange={(v) => set(rules.map((x, k) => (k === i ? { ...x, op: v } : x)))} options={OPS.map(([v, l]) => ({ value: v, label: l }))} />
          {r.op !== "empty" && <Input aria-label="Compare with" value={r.value} onChange={(e) => set(rules.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} placeholder={r.op === "matches" ? "^\\+1480" : "+14805550142"} />}
        </div>
      ))}
      <datalist id="flow-variables">{VARIABLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
      <Button variant="outline" size="sm" disabled={rules.length >= 20} onClick={() => set([...rules, { out: freshOut(), variable: "trigger.call.from", op: "contains", value: "" }])}><Plus /> Add rule</Button>
    </div>
  );
}

const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]] as const;
const ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu", "America/Puerto_Rico", "UTC"];
function HoursForm({ config, onChange }: FormProps) {
  const week = (config.week as Record<string, [string, string]>) ?? {};
  const holidays = (config.holidays as string[]) ?? [];
  const tz = String(config.tz ?? "America/Phoenix");
  const setDay = (d: string, v: [string, string] | null) => {
    const next = { ...week };
    if (v) next[d] = v; else delete next[d];
    onChange({ ...config, week: next });
  };
  return (
    <div className="space-y-4">
      <Field label="Time zone">
        <Pick label="Time zone" value={tz} onChange={(v) => onChange({ ...config, tz: v })}
          options={[...(!ZONES.includes(tz) ? [{ value: tz, label: tz }] : []), ...ZONES.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))]} />
      </Field>
      <Field label="Open hours">
        <div className="space-y-1.5">
          {DAYS.map(([d, label]) => {
            const h = week[d];
            return (
              <div key={d} className="space-y-1.5 rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex-1">{label}</span>
                  {!h && <span className="text-xs text-muted-foreground">Closed</span>}
                  <Switch checked={Boolean(h)} onCheckedChange={(on) => setDay(d, on ? ["08:00", "17:00"] : null)} aria-label={`Open on ${label}`} />
                </div>
                {h && (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                    <Input type="time" aria-label={`${label} opens`} value={h[0]} onChange={(e) => setDay(d, [e.target.value, h[1]])} className="h-8 min-w-0 px-1.5 text-xs md:text-xs" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="time" aria-label={`${label} closes`} value={h[1]} onChange={(e) => setDay(d, [h[0], e.target.value])} className="h-8 min-w-0 px-1.5 text-xs md:text-xs" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <Field label="Holidays" hint="On these dates the call takes the Holiday output.">
        <div className="space-y-1.5">
          {holidays.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="date" value={h} aria-label="Holiday date" onChange={(e) => onChange({ ...config, holidays: holidays.map((x, k) => (k === i ? e.target.value : x)) })} className="h-8" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove holiday" onClick={() => onChange({ ...config, holidays: holidays.filter((_, k) => k !== i) })}><X /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" disabled={holidays.length >= 60} onClick={() => onChange({ ...config, holidays: [...holidays, new Date().toISOString().slice(0, 10)] })}><Plus /> Add holiday</Button>
        </div>
      </Field>
    </div>
  );
}

type Target = { directoryId?: string; extensionId?: string; number?: string };
function ConnectForm({ config, onChange }: FormProps) {
  const { directory, extensions, lines } = useBuilder();
  const targets = (config.targets as Target[]) ?? [];
  const set = (t: Target[]) => onChange({ ...config, targets: t });
  const lineLabel = (id: string) => (lines.length > 1 ? ` · ${lines.find((l) => l.id === id)?.label ?? ""}` : "");
  const kind = (t: Target) => (t.extensionId !== undefined ? "extension" : t.directoryId !== undefined ? "directory" : "number");
  return (
    <div className="space-y-4">
      <Field label="Who to ring">
        <div className="space-y-2">
          {targets.map((t, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1"><Seg value={kind(t)} options={[["extension", "Extension"], ["directory", "Directory"], ["number", "Number"]]}
                  onChange={(k) => set(targets.map((x, j) => (j === i ? (k === "extension" ? { extensionId: extensions[0]?.id ?? "" } : k === "directory" ? { directoryId: directory[0]?.id ?? "" } : { number: "" }) : x)))} /></div>
                <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => set(targets.filter((_, j) => j !== i))}><X /></Button>
              </div>
              {kind(t) === "extension" ? (
                extensions.length ? (
                  <Pick label="Extension" value={t.extensionId ?? ""} onChange={(v) => set(targets.map((x, j) => (j === i ? { extensionId: v } : x)))}
                    options={extensions.map((x) => ({ value: x.id, label: `${x.ext} · ${x.name}${lineLabel(x.lineId)}` }))} />
                ) : <p className="text-xs text-muted-foreground">No extensions yet. Add them with the Extensions button at the top.</p>
              ) : kind(t) === "directory" ? (
                directory.length ? (
                  <Pick label="Directory contact" value={t.directoryId ?? ""} onChange={(v) => set(targets.map((x, j) => (j === i ? { directoryId: v } : x)))}
                    options={directory.map((d) => ({ value: d.id, label: `${d.label}${lineLabel(d.lineId)}` }))} />
                ) : <p className="text-xs text-muted-foreground">No Directory contacts yet. Add them in Calls → Directory.</p>
              ) : (
                <Input inputMode="tel" placeholder="+14805550142" value={t.number ?? ""} onChange={(e) => set(targets.map((x, j) => (j === i ? { number: e.target.value.replace(/[^\d+]/g, "") } : x)))} aria-label="Number to ring" />
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" disabled={targets.length >= 10} onClick={() => set([...targets, extensions[0] ? { extensionId: extensions[0].id } : directory[0] ? { directoryId: directory[0].id } : { number: "" }])}><Plus /> Add who to ring</Button>
        </div>
      </Field>
      {targets.length > 1 && (
        <Field label="Ring">
          <Seg value={String(config.mode ?? "one")} options={[["all", "All at once"], ["order", "In order"], ["one", "First only"]]} onChange={(v) => onChange({ ...config, mode: v })} />
        </Field>
      )}
      <Field label="Ring for">
        <Pick label="Ring for" value={String(config.ringSeconds ?? 20)} onChange={(v) => onChange({ ...config, ringSeconds: Number(v) })}
          options={[10, 15, 20, 25, 30, 45, 60].map((s) => ({ value: String(s), label: `${s} seconds` }))} />
      </Field>
      <Field label="Whisper" hint="Said privately to the person who answers, before the caller is connected.">
        <Input maxLength={300} value={String(config.whisper ?? "")} placeholder="Call from the main menu, Sales." onChange={(e) => onChange({ ...config, whisper: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

function VoicemailForm({ config, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <PromptField label="Greeting" optional value={config.prompt as Prompt | undefined} onChange={(p) => onChange({ ...config, prompt: p })} />
      <Field label="Longest message">
        <Pick label="Longest message" value={String(config.maxSeconds ?? 120)} onChange={(v) => onChange({ ...config, maxSeconds: num(v, 10, 300, 120) })}
          options={[30, 60, 120, 180, 300].map((s) => ({ value: String(s), label: s < 60 ? `${s} seconds` : `${s / 60} ${s === 60 ? "minute" : "minutes"}` }))} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span><span className="block text-sm font-medium">Transcribe with Echo</span><span className="block text-xs text-muted-foreground">Read the message instead of listening.</span></span>
        <Switch checked={config.transcribe !== false} onCheckedChange={(v) => onChange({ ...config, transcribe: v })} />
      </label>
    </div>
  );
}

function HangupForm({ config, onChange }: FormProps) {
  return <PromptField label="Goodbye message" optional value={config.prompt as Prompt | undefined} onChange={(p) => onChange({ ...config, prompt: p })} />;
}

export const FORMS: Partial<Record<BlockType, (p: FormProps) => React.ReactNode>> = {
  say: SayForm, gather: GatherForm, split: SplitForm, hours: HoursForm, connect: ConnectForm, voicemail: VoicemailForm, hangup: HangupForm,
};
