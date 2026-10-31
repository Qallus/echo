"use client";

import { Briefcase, Lock } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

// Where a new recording is saved: Business (team can hear it) or Personal (only you).
export function WorkspacePicker({ workspaces, value, onChange }: {
  workspaces: Workspace[]; value: string | null; onChange: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Save to</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {workspaces.map((w) => (
          <button key={w.id} type="button" aria-pressed={value === w.id} onClick={() => onChange(w.id)}
            className={cn("flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
              value === w.id && "border-primary ring-1 ring-primary")}>
            {w.isPersonal ? <Lock className="mb-1.5 size-4" /> : <Briefcase className="mb-1.5 size-4" />}
            <span className="w-full truncate text-sm font-medium">{w.isPersonal ? "Personal" : w.name}</span>
            <span className="text-xs text-muted-foreground">{w.isPersonal ? "Only you" : "Your team can hear it"}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
