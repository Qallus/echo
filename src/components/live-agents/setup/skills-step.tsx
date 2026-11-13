"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconByName } from "@/components/live-agents/icons";
import { saveAgentSkills } from "@/lib/live-agents/agent-actions";
import { COMMON_LANGUAGES } from "@/lib/live-agents/setup";
import type { Skill } from "@/lib/live-agents/types";
import { StepFooter, ToggleChip } from "./step-footer";

const GROUPS = [
  { id: "calls", label: "On the call" },
  { id: "industry", label: "Specialties" },
  { id: "follow-up", label: "After the call" },
];

// Step 4: what you do on calls (from Redial's catalog) and your languages.
export function SkillsStep({ catalog, initial }: { catalog: Skill[]; initial: { skills: string[]; languages: string[] } }) {
  const [skills, setSkills] = useState<string[]>(initial.skills);
  const [languages, setLanguages] = useState<string[]>(initial.languages.length ? initial.languages : ["English"]);
  const [custom, setCustom] = useState("");
  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, v: T, max: number) => set((l) => (l.includes(v) ? l.filter((x) => x !== v) : l.length >= max ? l : [...l, v]));
  const langs = [...new Set([...COMMON_LANGUAGES, ...languages])];

  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const items = catalog.filter((s) => s.category === g.id);
        if (!items.length) return null;
        return (
          <fieldset key={g.id} className="space-y-2">
            <legend className="text-sm font-medium">{g.label}</legend>
            <div className="flex flex-wrap gap-1.5">
              {items.map((s) => (
                <ToggleChip key={s.slug} on={skills.includes(s.slug)} onClick={() => toggle(setSkills, s.slug, 16)}>
                  <IconByName name={s.icon} className="size-3.5" /> {s.label}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
        );
      })}
      <p className="text-xs text-muted-foreground">{skills.length} selected · pick at least 2. Only list what you&apos;re comfortable doing on a live call.</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Languages you take calls in <span className="font-normal text-muted-foreground">(up to 8)</span></legend>
        <div className="flex flex-wrap gap-1.5">{langs.map((l) => <ToggleChip key={l} on={languages.includes(l)} onClick={() => toggle(setLanguages, l, 8)}>{l}</ToggleChip>)}</div>
        <form className="flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); const v = custom.trim().slice(0, 30); if (v && !languages.includes(v) && languages.length < 8) setLanguages((l) => [...l, v]); setCustom(""); }}>
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Another language" maxLength={30} />
          <Button type="submit" variant="outline">Add</Button>
        </form>
      </fieldset>

      <StepFooter step={4} save={() => saveAgentSkills({ skills, languages })} />
    </div>
  );
}
