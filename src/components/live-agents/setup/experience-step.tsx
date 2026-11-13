"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveAgentExperience } from "@/lib/live-agents/agent-actions";
import { COMMON_INDUSTRIES } from "@/lib/live-agents/setup";
import { Field, StepFooter, ToggleChip } from "./step-footer";

export type ExperienceInitial = { years: number; bio: string; experience: { title: string; detail?: string }[]; industries: string[] };

// Step 3: years on the phones, a short bio, past roles and industries.
export function ExperienceStep({ initial }: { initial: ExperienceInitial }) {
  const [years, setYears] = useState(String(initial.years || ""));
  const [bio, setBio] = useState(initial.bio);
  const [roles, setRoles] = useState(initial.experience.length ? initial.experience.map((e) => ({ title: e.title, detail: e.detail ?? "" })) : [{ title: "", detail: "" }]);
  const [industries, setIndustries] = useState<string[]>(initial.industries);
  const [custom, setCustom] = useState("");
  const toggle = (i: string) => setIndustries((l) => (l.includes(i) ? l.filter((x) => x !== i) : l.length >= 8 ? l : [...l, i]));
  const all = [...new Set([...COMMON_INDUSTRIES, ...industries])];

  return (
    <div className="space-y-6">
      <Field label="Years answering business phones"><Input className="w-28" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="5" /></Field>
      <Field label="About you" hint={`${bio.length}/600 · The calls you're great at and how you make callers feel. No phone numbers, emails or links.`}>
        <Textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600}
          placeholder="Seven years running a busy dental front desk. I book, confirm and reschedule, verify insurance, and switch to Spanish whenever a caller is more comfortable." />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Past roles</legend>
        <p className="text-xs text-muted-foreground">The kind of company is enough; you don&apos;t need to name it.</p>
        {roles.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input value={r.title} maxLength={80} placeholder="Front desk lead, dental practice" aria-label={`Role ${i + 1}`} onChange={(e) => setRoles((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Input value={r.detail} maxLength={120} placeholder="5 years · scheduling, insurance" aria-label={`Role ${i + 1} details`} onChange={(e) => setRoles((l) => l.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove role" onClick={() => setRoles((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [{ title: "", detail: "" }]))}><X /></Button>
          </div>
        ))}
        {roles.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => setRoles((l) => [...l, { title: "", detail: "" }])}><Plus /> Add a role</Button>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Industries you know <span className="font-normal text-muted-foreground">(up to 8)</span></legend>
        <div className="flex flex-wrap gap-1.5">{all.map((i) => <ToggleChip key={i} on={industries.includes(i)} onClick={() => toggle(i)}>{i}</ToggleChip>)}</div>
        <form className="flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); const v = custom.trim().slice(0, 30); if (v && !industries.includes(v) && industries.length < 8) setIndustries((l) => [...l, v]); setCustom(""); }}>
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Another industry" maxLength={30} />
          <Button type="submit" variant="outline">Add</Button>
        </form>
      </fieldset>

      <StepFooter step={3} save={() => saveAgentExperience({ years: Number(years || 0), bio, experience: roles, industries })} />
    </div>
  );
}
