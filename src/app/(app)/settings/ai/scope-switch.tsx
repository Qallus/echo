"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setAiKeyScope } from "./actions";

// Business workspace owners: one set of keys for the team, or each person's own.
export function ScopeSwitch({ workspaceId, value }: { workspaceId: string; value: "workspace" | "member" }) {
  const [scope, setScope] = useState(value);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const choose = (next: "workspace" | "member") => {
    if (next === scope) return;
    const prev = scope;
    setScope(next);
    start(async () => { const res = await setAiKeyScope(workspaceId, next); setMsg(res); if (res.error) setScope(prev); });
  };
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {([["workspace", "Team keys", "Everyone in this workspace uses the keys below."],
           ["member", "Each person's own keys", "Members use the keys they add under Your keys; Echo's otherwise."]] as const).map(([v, title, hint]) => (
          <button key={v} type="button" disabled={pending} aria-pressed={scope === v} onClick={() => choose(v)}
            className={cn("rounded-lg border p-3 text-left text-sm hover:bg-muted/50", scope === v && "border-primary ring-1 ring-primary")}>
            <span className="block font-medium">{title}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    </div>
  );
}
