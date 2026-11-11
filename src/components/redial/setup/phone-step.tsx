"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARRIERS } from "@/lib/redial/carriers";
import { DEVICES, LINE_TYPES, type PhoneAnswers } from "@/lib/redial/setup";
import { cn } from "@/lib/utils";
import { Choice } from "./setup-shell";
import { StepActions } from "./step-actions";

// Step 2: the carrier, the phone and the kind of line, which decide how
// calls can reach Redial in step 3.
export function PhoneStep({ initial, accountType }: { initial?: Partial<PhoneAnswers>; accountType: "personal" | "business" }) {
  const [lineType, setLineType] = useState(initial?.lineType ?? "mobile");
  const [carrier, setCarrier] = useState(initial?.carrier ?? "");
  const [device, setDevice] = useState(initial?.device ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const mobile = lineType === "mobile";
  const values = { lineType, carrier: mobile ? carrier : "other", device: device || (mobile ? "" : "desk"), provider: mobile ? undefined : provider };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">This tells us how to send your calls to your assistant without changing your number.</p>

      <div className="space-y-2">
        <Label>What kind of line is it?</Label>
        <div role="radiogroup" aria-label="Kind of line" className="grid gap-2">
          {LINE_TYPES.filter((l) => accountType === "business" || l.id !== "voip").map((l) => (
            <Choice key={l.id} selected={lineType === l.id} onSelect={() => setLineType(l.id)} title={l.label} detail={l.detail} />
          ))}
        </div>
      </div>

      {mobile ? (
        <>
          <div className="space-y-2">
            <Label>Your carrier</Label>
            <div role="radiogroup" aria-label="Carrier" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CARRIERS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={carrier === c.id} onClick={() => setCarrier(c.id)}
                  className={cn("rounded-lg border px-3 py-2.5 text-left text-sm transition-colors", carrier === c.id ? "border-foreground bg-muted/50 font-medium" : "hover:bg-muted/40")}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Your phone</Label>
            <div role="radiogroup" aria-label="Phone" className="grid grid-cols-2 gap-2">
              {DEVICES.filter((d) => d.id === "iphone" || d.id === "android").map((d) => (
                <Choice key={d.id} selected={device === d.id} onSelect={() => setDevice(d.id)} title={d.label} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="su-provider">{lineType === "voip" ? "Which service?" : "Which phone company?"}</Label>
          <Input id="su-provider" maxLength={80} placeholder={lineType === "voip" ? "e.g. RingCentral" : "e.g. Cox, Spectrum"} value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
      )}

      <StepActions step={2} values={values} disabled={mobile ? !carrier || !device : !provider.trim()} />
    </div>
  );
}
