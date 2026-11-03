"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveAiSettings } from "@/lib/admin/actions/ai";
import { MODELS, type ModelId } from "@/lib/ai/models";
import type { AiSettings } from "@/lib/ai/settings";

const SELECT = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const label = (id: ModelId) => MODELS.find((m) => m.id === id)?.label ?? id;

// Which providers customers can use with Echo's keys, the default chat model,
// the order summaries try models in, Echo's model per provider and prices.
export function AiSettingsForm({ initial, configured, defaults, readOnly }: {
  initial: AiSettings; configured: Record<string, boolean>; defaults: Record<string, string>; readOnly: boolean;
}) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const priceModels = [...new Set([...Object.keys(s.prices), ...MODELS.map((m) => s.models[m.id] || defaults[m.id])])];

  const move = (i: number, d: -1 | 1) => setS((x) => {
    const order = [...x.summaryOrder];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    return { ...x, summaryOrder: order };
  });

  return (
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); start(async () => setMsg(await saveAiSettings(s))); }}>
      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="mb-2 font-medium">Providers</legend>
        <ul className="divide-y rounded-xl border">
          {MODELS.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <Switch checked={s.enabled.includes(m.id)} aria-label={`Enable ${m.label}`}
                onCheckedChange={(on) => setS((x) => ({ ...x, enabled: on ? [...x.enabled, m.id] : x.enabled.filter((e) => e !== m.id) }))} />
              <span className="w-28 font-medium">{m.label}</span>
              <span className={configured[m.id] ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-muted-foreground"}>{configured[m.id] ? "Echo key set" : "No Echo key"}</span>
              <Input className="h-8 max-w-64 flex-1 text-sm" aria-label={`${m.label} model`} placeholder={`Model (default: ${defaults[m.id]})`}
                value={s.models[m.id] ?? ""} onChange={(e) => setS((x) => ({ ...x, models: { ...x.models, [m.id]: e.target.value } }))} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Turning a provider off hides it unless a customer has added their own key for it.</p>
      </fieldset>

      <fieldset disabled={readOnly} className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <legend className="font-medium">Default for Ask Echo</legend>
          <select className={SELECT} value={s.defaultChat} onChange={(e) => setS((x) => ({ ...x, defaultChat: e.target.value as ModelId }))}>
            {MODELS.filter((m) => s.enabled.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Summary order</p>
          <p className="text-xs text-muted-foreground">Summaries try each in turn until one answers (customers&apos; own keys first).</p>
          <ol className="space-y-1">
            {s.summaryOrder.map((id, i) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1">{label(id)}{!s.enabled.includes(id) && <span className="text-xs text-muted-foreground"> · off</span>}</span>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === s.summaryOrder.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
              </li>
            ))}
          </ol>
          {MODELS.some((m) => !s.summaryOrder.includes(m.id)) && (
            <select className={SELECT} value="" onChange={(e) => e.target.value && setS((x) => ({ ...x, summaryOrder: [...x.summaryOrder, e.target.value as ModelId] }))}>
              <option value="">Add to the order…</option>
              {MODELS.filter((m) => !s.summaryOrder.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
        </div>
      </fieldset>

      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="mb-1 font-medium">Prices for cost estimates</legend>
        <p className="text-xs text-muted-foreground">US cents per million tokens. Used to estimate spend on the Usage tab; check each provider&apos;s pricing page.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {priceModels.map((model) => (
            <div key={model} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
              <code className="min-w-0 flex-1 truncate text-xs">{model}</code>
              {(["input", "output"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-xs text-muted-foreground">{k}
                  <Input type="number" min={0} step="any" className="h-7 w-20 text-xs" value={s.prices[model]?.[k] ?? ""}
                    onChange={(e) => setS((x) => ({ ...x, prices: { ...x.prices, [model]: { input: x.prices[model]?.input ?? 0, output: x.prices[model]?.output ?? 0, [k]: Number(e.target.value) } } }))} />
                </label>
              ))}
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">Transcription, cents per minute
          <Input type="number" min={0} step="any" className="h-8 w-24" value={s.transcriptionCentsPerMinute}
            onChange={(e) => setS((x) => ({ ...x, transcriptionCentsPerMinute: Number(e.target.value) }))} />
        </label>
      </fieldset>

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save AI settings"}</Button>
          {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
          {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
        </div>
      )}
    </form>
  );
}
