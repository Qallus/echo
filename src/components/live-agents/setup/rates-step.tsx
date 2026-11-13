"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveAgentRates } from "@/lib/live-agents/agent-actions";
import { feeSplit, money, WEEKDAYS, type Fees, type Weekday } from "@/lib/live-agents/types";
import { Field, StepFooter } from "./step-footer";

export type RatesInitial = { perMinuteCents: number | null; hourlyCents: number | null; retainerCents: number | null; retainerHours: number | null; availability: Partial<Record<Weekday, [string, string]>> };

const dollars = (c: number | null) => (c == null ? "" : (c / 100).toFixed(c % 100 ? 2 : 0));
const toCents = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100));

// Step 7: what you charge (businesses add Redial's fee on top) and when
// you're available each week.
export function RatesStep({ initial, fees }: { initial: RatesInitial; fees: Fees }) {
  const [perMinute, setPerMinute] = useState(dollars(initial.perMinuteCents));
  const [hourly, setHourly] = useState(dollars(initial.hourlyCents));
  const [retainer, setRetainer] = useState(dollars(initial.retainerCents));
  const [retainerHours, setRetainerHours] = useState(initial.retainerHours == null ? "" : String(initial.retainerHours));
  const start = Object.keys(initial.availability).length ? initial.availability
    : { mon: ["09:00", "17:00"], tue: ["09:00", "17:00"], wed: ["09:00", "17:00"], thu: ["09:00", "17:00"], fri: ["09:00", "17:00"] } as RatesInitial["availability"];
  const [days, setDays] = useState<Record<Weekday, { on: boolean; from: string; to: string }>>(
    Object.fromEntries(WEEKDAYS.map(({ key }) => [key, { on: Boolean(start[key]), from: start[key]?.[0] ?? "09:00", to: start[key]?.[1] ?? "17:00" }])) as Record<Weekday, { on: boolean; from: string; to: string }>,
  );

  const take = (v: string, suffix: string) => {
    const c = toCents(v);
    if (c == null || c <= 0) return null;
    const s = feeSplit(c, fees);
    return <>You receive <span className="font-medium text-foreground">{money(s.agent, { exact: true })}{suffix}</span> · businesses pay {money(s.business, { exact: true })}{suffix}</>;
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-muted-foreground">Set your own rates. Businesses pay your rate plus a {fees.businessFeePercent}% service fee; Redial keeps {fees.agentFeePercent}% of your rate for payments, call routing, recording and support.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="On-demand, per connected minute" hint={take(perMinute, "/min") ?? "For calls transferred to you as they come in. $0.10–$10.00."}>
            <DollarInput value={perMinute} onChange={setPerMinute} placeholder="0.85" />
          </Field>
          <Field label="Scheduled shifts, per hour" hint={take(hourly, "/hr") ?? "For booked blocks of time. $10–$200."}>
            <DollarInput value={hourly} onChange={setHourly} placeholder="30" />
          </Field>
          <Field label="Monthly plan, price (optional)" hint={take(retainer, "/mo") ?? "A block of hours each month, then your per-minute rate."}>
            <DollarInput value={retainer} onChange={setRetainer} placeholder="1150" />
          </Field>
          <Field label="Hours included each month">
            <Input inputMode="numeric" value={retainerHours} onChange={(e) => setRetainerHours(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="40" />
          </Field>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Weekly hours</legend>
        <p className="text-xs text-muted-foreground">In your time zone. Businesses can still ask for other hours, and you can go &ldquo;Available now&rdquo; any time once you&apos;re live.</p>
        <div className="divide-y rounded-2xl border">
          {WEEKDAYS.map(({ key, short }) => {
            const d = days[key];
            const set = (p: Partial<typeof d>) => setDays((all) => ({ ...all, [key]: { ...all[key], ...p } }));
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <label className="flex w-24 items-center gap-2 text-sm"><Switch checked={d.on} onCheckedChange={(v) => set({ on: v })} /> {short}</label>
                {d.on ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Input type="time" className="w-32" value={d.from} onChange={(e) => set({ from: e.target.value })} aria-label={`${short} start`} />
                    <span className="text-muted-foreground">to</span>
                    <Input type="time" className="w-32" value={d.to === "23:59" ? "23:59" : d.to} onChange={(e) => set({ to: e.target.value })} aria-label={`${short} end`} />
                  </div>
                ) : <span className="text-sm text-muted-foreground">Off</span>}
              </div>
            );
          })}
        </div>
      </fieldset>

      <StepFooter step={7} save={() => saveAgentRates({
        perMinute, hourly, retainer, retainerHours,
        availability: Object.fromEntries(WEEKDAYS.filter(({ key }) => days[key].on).map(({ key }) => [key, [days[key].from, days[key].to]])),
      })} />
    </div>
  );
}

function DollarInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input inputMode="decimal" className="pl-6" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))} />
    </div>
  );
}
