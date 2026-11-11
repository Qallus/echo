"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { PhoneInput, formatPhone } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import type { AfterAnswers } from "@/lib/redial/setup";
import { NumberList, toE164 } from "./number-list";
import { StepActions } from "./step-actions";

// Step 6: where your assistant rings you, whether it can put important calls through, how
// you hear about calls, and (for businesses) who it can transfer to.
export function AfterStep({ initial, mobile, forwarding, business }: {
  initial?: Partial<AfterAnswers>; mobile: string; forwarding: boolean; business: boolean;
}) {
  const [forwardTo, setForwardTo] = useState(initial?.forwardTo ?? (forwarding ? "" : mobile));
  const [putThrough, setPutThrough] = useState(initial?.putThrough ?? true);
  const [alerts, setAlerts] = useState(initial?.alerts ?? { push: true, sms: false, email: true });
  const [directory, setDirectory] = useState((initial?.directory ?? []).map((d) => ({ ...d })));
  const ring = toE164(forwardTo);
  const loops = forwarding && ring && ring === mobile;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">What happens once your assistant knows who&apos;s calling.</p>

      <div className="space-y-2 rounded-xl border p-4">
        <label className="flex items-center justify-between gap-4">
          <span><span className="block text-sm font-medium">Put important calls through to me</span><span className="block text-sm text-muted-foreground">Family, expected calls and urgent matters. Otherwise your assistant takes a message.</span></span>
          <Switch checked={putThrough} onCheckedChange={setPutThrough} />
        </label>
        {putThrough && (
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="su-ring">Ring this number <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <PhoneInput id="su-ring" className="max-w-xs" placeholder="(480) 555-0142" value={forwardTo} onChange={setForwardTo} />
            <p className={loops ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {loops
                ? `${formatPhone(mobile)} forwards to Redial, so ringing it would loop. Use another number, or leave this empty and take calls in the Redial app.`
                : forwarding
                  ? "Not the phone that forwards to Redial. Leave it empty to take calls in the Redial app instead."
                  : "Usually your cell. You press 1 to take the call."}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tell me about calls by</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["push", "Redial app", "A notification on your phone"], ["sms", "Text", "To your verified mobile"], ["email", "Email", "A summary in your inbox"]] as const).map(([k, title, detail]) => (
            <label key={k} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
              <Switch checked={alerts[k]} onCheckedChange={(on) => setAlerts({ ...alerts, [k]: on })} />
            </label>
          ))}
        </div>
      </div>

      {business && (
        <div className="space-y-2">
          <Label>Transfer to</Label>
          <p className="text-sm text-muted-foreground">Teammates or numbers your assistant can send callers to. They hear who&apos;s calling first.</p>
          <NumberList items={directory} onChange={setDirectory} max={10} named addLabel="Add" />
        </div>
      )}

      <StepActions step={6} disabled={Boolean(loops)}
        values={{ forwardTo: putThrough && ring ? ring : undefined, putThrough, alerts, directory: directory.map((d) => ({ label: d.label ?? "", number: d.number })) }} />
    </div>
  );
}
