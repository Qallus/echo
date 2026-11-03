"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveBillingSettings } from "@/lib/admin/actions/billing";
import type { BillingSettings } from "@/lib/billing/settings";

export function BillingSettingsForm({ initial, readOnly }: { initial: BillingSettings; readOnly: boolean }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <form className="max-w-xl space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => setMsg(await saveBillingSettings(s))); }}>
      <fieldset disabled={readOnly} className="space-y-5">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Free minutes a month</span>
          <Input type="number" min={0} className="max-w-40" value={s.freeMinutes} onChange={(e) => setS({ ...s, freeMinutes: Number(e.target.value) })} />
          <span className="block text-xs text-muted-foreground">Transcription minutes for accounts without a plan.</span>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Discount for customers using their own AI keys (%)</span>
          <Input type="number" min={0} max={90} className="max-w-40" value={s.byokDiscountPercent} onChange={(e) => setS({ ...s, byokDiscountPercent: Number(e.target.value) })} />
          <span className="block text-xs text-muted-foreground">Applied automatically at checkout to subscriptions when the customer has a working key. 0 turns it off.</span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Switch checked={s.enforceLimits} onCheckedChange={(enforceLimits) => setS({ ...s, enforceLimits })} className="mt-0.5" />
          <span>
            <span className="font-medium">Enforce minute limits</span>
            <span className="block text-xs text-muted-foreground">Off: customers see their usage, nothing is blocked. On: new transcriptions stop once the month&apos;s minutes and packs are used. Turn on at launch.</span>
          </span>
        </label>
      </fieldset>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>Save</Button>
          {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
          {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
        </div>
      )}
    </form>
  );
}
