"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Briefcase, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickCrmWorkspace } from "./actions";

// Which workspace's contacts, pipeline, plans, docs and cards to show.
// Remembered in a cookie so every CRM page (and its actions) agree.
export function WorkspaceSwitch({ current, workspaces }: { current: string; workspaces: { id: string; name: string; personal: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (id: string) => {
    start(async () => { await pickCrmWorkspace(id); router.refresh(); });
  };
  return (
    <div role="radiogroup" aria-label="Workspace" className="slide-row flex items-center gap-1 rounded-xl border bg-muted/40 p-1 text-sm max-md:w-full md:w-fit">
      {workspaces.map((w) => {
        const on = w.id === current;
        const Icon = w.personal ? Lock : Briefcase;
        return (
          <button key={w.id} type="button" role="radio" aria-checked={on} onClick={() => !on && pick(w.id)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors", on ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="size-3.5" /> {w.name}
          </button>
        );
      })}
      {pending && <Loader2 className="ml-1 size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
