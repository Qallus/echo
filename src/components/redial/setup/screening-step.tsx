"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { SCREEN_MODES, type ScreeningAnswers } from "@/lib/redial/setup";
import { normalizeNumber } from "@/lib/redial/types";
import { NumberList } from "./number-list";
import { Choice } from "./setup-shell";
import { StepActions } from "./step-actions";

// Step 4: who your assistant answers for, who always gets through, who never does, and
// (for businesses) the hours your assistant can tell callers. Optional:
// "Protect a parent" (a family code word and one trusted contact).
export function ScreeningStep({ initial, business }: { initial?: Partial<ScreeningAnswers>; business: boolean }) {
  const [mode, setMode] = useState(initial?.mode ?? "unknown");
  const [vip, setVip] = useState((initial?.vip ?? []).map((number) => ({ number })));
  const [block, setBlock] = useState((initial?.block ?? []).map((number) => ({ number })));
  const [hoursOn, setHoursOn] = useState(Boolean(initial?.hours));
  const [hours, setHours] = useState(initial?.hours ?? { start: "09:00", end: "17:00", weekdays: true });
  const savedProtect = initial?.protect;
  const [protectOn, setProtectOn] = useState(Boolean(savedProtect));
  const [codeWord, setCodeWord] = useState("");
  const [trusted, setTrusted] = useState({ name: savedProtect?.trusted?.name ?? "", phone: savedProtect?.trusted?.phone ?? "", email: savedProtect?.trusted?.email ?? "" });
  const trustedPhone = trusted.phone.trim() ? normalizeNumber(trusted.phone) ?? trusted.phone.trim() : undefined;
  const protect = protectOn ? {
    ...(codeWord.trim() ? { codeWord: codeWord.trim() } : {}),
    ...(trusted.name.trim() ? { trusted: { name: trusted.name.trim(), ...(trustedPhone ? { phone: trustedPhone } : {}), ...(trusted.email.trim() ? { email: trusted.email.trim() } : {}) } } : {}),
  } : undefined;
  const values = { mode, vip: vip.map((v) => v.number), block: block.map((b) => b.number), ...(business && hoursOn ? { hours } : {}), ...(protect ? { protect } : {}) };

  return (
    <div className="space-y-7">
      <p className="text-muted-foreground">Choose which calls your assistant answers first. VIPs always ring straight through.</p>
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
            <span><span className="block text-sm font-medium">Business hours</span><span className="block text-sm text-muted-foreground">Your assistant can tell callers when you&apos;re open.</span></span>
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

      <div className="space-y-3 rounded-xl border p-4">
        <label className="flex items-center justify-between gap-4">
          <span><span className="flex items-center gap-1.5 text-sm font-medium"><ShieldCheck className="size-4" /> Protect a parent from phone scams</span>
            <span className="block text-sm text-muted-foreground">Optional. Set a family code word your assistant asks for, and pick someone to hear if a scam is stopped.</span></span>
          <Switch checked={protectOn} onCheckedChange={setProtectOn} />
        </label>
        {protectOn && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="setup-code-word">Family code word</Label>
              <Input id="setup-code-word" type="password" autoComplete="off" maxLength={40} value={codeWord} onChange={(e) => setCodeWord(e.target.value)}
                placeholder={savedProtect?.codeWordCipher ? "A code word is saved; type to change it" : "e.g. bluebird"} />
              <p className="text-xs text-muted-foreground">Callers who say they&apos;re family are asked for it. It&apos;s stored encrypted, and your assistant never sees it.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-trusted-name">Trusted contact</Label>
              <Input id="setup-trusted-name" maxLength={80} value={trusted.name} onChange={(e) => setTrusted({ ...trusted, name: e.target.value })} placeholder="Their name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-trusted-phone">Their mobile</Label>
              <Input id="setup-trusted-phone" type="tel" value={trusted.phone} onChange={(e) => setTrusted({ ...trusted, phone: e.target.value })} placeholder="(480) 555-0142" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="setup-trusted-email">Their email (optional)</Label>
              <Input id="setup-trusted-email" type="email" value={trusted.email} onChange={(e) => setTrusted({ ...trusted, email: e.target.value })} placeholder="name@example.com" />
              <p className="text-xs text-muted-foreground">Once your line is ready, send them the invite from Calls → Protection; texts start after they reply YES.</p>
            </div>
          </div>
        )}
      </div>

      <StepActions step={4} values={values} />
    </div>
  );
}
