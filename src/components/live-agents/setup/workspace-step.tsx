"use client";

import { useState } from "react";
import { IconByName } from "@/components/live-agents/icons";
import { saveAgentWorkspace } from "@/lib/live-agents/agent-actions";
import { EQUIPMENT, WORKSPACE, type Attribute } from "@/lib/live-agents/types";
import { StepFooter, ToggleChip } from "./step-footer";

// Step 5: the gear and space you take calls from. Businesses filter on
// these, so only pick what's true today.
export function WorkspaceStep({ initial }: { initial: { equipment: string[]; workspace: string[] } }) {
  const [equipment, setEquipment] = useState<string[]>(initial.equipment);
  const [workspace, setWorkspace] = useState<string[]>(initial.workspace);
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, slug: string) => set((l) => (l.includes(slug) ? l.filter((x) => x !== slug) : [...l, slug]));

  const group = (title: string, items: Attribute[], picked: string[], set: React.Dispatch<React.SetStateAction<string[]>>) => {
    const groups = [...new Set(items.map((i) => i.group))];
    return (
      <section className="space-y-4">
        <h2 className="font-semibold">{title}</h2>
        {groups.map((g) => (
          <fieldset key={g} className="space-y-2">
            <legend className="text-sm text-muted-foreground">{g}</legend>
            <div className="flex flex-wrap gap-1.5">
              {items.filter((i) => i.group === g).map((i) => (
                <ToggleChip key={i.slug} on={picked.includes(i.slug)} onClick={() => toggle(set, i.slug)}>
                  <IconByName name={i.icon} className="size-3.5" /> {i.label}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">Businesses want to know their callers will hear a clear, quiet, professional line. Pick everything that&apos;s true today; you can update it any time.</p>
      {group("Equipment", EQUIPMENT, equipment, setEquipment)}
      {group("Workspace", WORKSPACE, workspace, setWorkspace)}
      <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        Tip: a headset with a microphone, a room with a door, and wired or backup internet are what businesses filter on most.
      </p>
      <StepFooter step={5} save={() => saveAgentWorkspace({ equipment, workspace })} />
    </div>
  );
}
