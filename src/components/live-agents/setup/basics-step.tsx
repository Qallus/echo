"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { saveAgentBasics } from "@/lib/live-agents/agent-actions";
import { TIME_ZONES, US_STATES } from "@/lib/live-agents/setup";
import { Field, StepFooter } from "./step-footer";

export type BasicsInitial = { firstName: string; lastName: string; headline: string; city: string; region: string; timeZone: string };

// Step 1: who you are (first name + last initial shown), a headline and
// roughly where you are.
export function BasicsStep({ initial }: { initial: BasicsInitial }) {
  const [f, setF] = useState(initial);
  const set = (p: Partial<BasicsInitial>) => setF((x) => ({ ...x, ...p }));
  const shown = f.firstName.trim() ? `${f.firstName.trim()} ${f.lastName.trim() ? `${f.lastName.trim()[0].toUpperCase()}.` : ""}` : "Maya R.";
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">This is the top of your profile. Businesses see your first name and last initial, never your full name.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name"><Input value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} maxLength={30} autoComplete="given-name" /></Field>
        <Field label="Last name" hint={<>Shown as <span className="font-medium text-foreground">{shown}</span></>}><Input value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} maxLength={30} autoComplete="family-name" /></Field>
      </div>
      <Field label="Headline" hint={`${f.headline.length}/90 · What you're great at, in one line. For example: "Warm, organized front desk for dental offices"`}>
        <Input value={f.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={90} placeholder="Calm, friendly answering for busy offices" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_10rem]">
        <Field label="City" hint="Shown by area only (about 3 km), never your address."><Input value={f.city} onChange={(e) => set({ city: e.target.value })} maxLength={60} autoComplete="address-level2" /></Field>
        <Field label="State"><Pick label="State" value={f.region} onChange={(v) => set({ region: v })} options={[{ value: "", label: "State" }, ...US_STATES.map((s) => ({ value: s, label: s }))]} /></Field>
        <Field label="Time zone"><Pick label="Time zone" value={f.timeZone} onChange={(v) => set({ timeZone: v })} options={TIME_ZONES} /></Field>
      </div>
      <StepFooter step={1} save={() => saveAgentBasics(f)} />
    </div>
  );
}
