"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { SCREEN_MODES, type ScreeningAnswers } from "@/lib/redial/setup";
import { NumberList } from "./number-list";
import { Choice } from "./setup-shell";
import { StepActions } from "./step-actions";

// Step 4: who DJ answers for, who always gets through, who never does, and
// (for businesses) the hours DJ can tell callers.
export function ScreeningStep({ initial, business }: { initial?: Partial<ScreeningAnswers>; business: boolean }) {
  const [mode, setMode] = useState(initial?.mode ?? "unknown");
  const [vip, setVip] = useState((initial?.vip ?? []).map((number) => ({ number })));
  const [block, setBlock] = useState((initial?.block ?? []).map((number) => ({ number })));
  const [hoursOn, setHoursOn] = useState(Boolean(initial?.hours));
  const [hours, setHours] = useState(initial?.hours ?? { start: "09:00", end: "17:00", weekdays: true });
  const values = { mode, vip: vip.map((v) => v.number), block: block.map((b) => b.number), ...(business && hoursOn ? { hours } : {}) };

  return (
    <div className="space-y-7">
      <p className="text-muted-foreground">Choose which calls DJ answers first. VIPs always ring straight through.</p>
      <div role="radiogroup" aria-label="Who gets screened" className="grid gap-2">
        {SCREEN_MODES.map((m) => <Choice key={m.id} selected={mode === m.id} onSelect={() => setMode(m.id)} title={m.label} detail={m.detail} tag={"tag" in m ? m.tag : undefined} />)}
      </div>

      <div className="space-y-2">
        <Label>VIPs: always ring through</Label>
        <p className="text-sm text-muted-foreground">Family, your kids&apos; school, your best clients. Add more later from Calls.</p>
        <NumberList items={vip} onChange={setVip} max={20} addLabel="Add VIP" />
      </div>

      <div className="space-y-2">
        <Label>Block: never get through</Label>
        <NumberList items={block} onChange={setBlock} max={20} addLabel="Block" />
      </div>

      {business && (
        <div className="space-y-3 rounded-xl border p-4">
          <label className="flex items-center justify-between gap-4">
            <span><span className="block text-sm font-medium">Business hours</span><span className="block text-sm text-muted-foreground">DJ can tell callers when you&apos;re open.</span></span>
            <Switch checked={hoursOn} onCheckedChange={setHoursOn} />
          </label>
          {hoursOn && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <TimePicker value={hours.start} onChange={(start) => setHours({ ...hours, start })} step={30} aria-label="Opens" />
              <span>to</span>
              <TimePicker value={hours.end} onChange={(end) => setHours({ ...hours, end })} step={30} aria-label="Closes" />
              <label className="ml-2 flex items-center gap-2"><Switch checked={hours.weekdays} onCheckedChange={(weekdays) => setHours({ ...hours, weekdays })} /> Monday to Friday only</label>
            </div>
          )}
        </div>
      )}

      <StepActions step={4} values={values} />
    </div>
  );
}
