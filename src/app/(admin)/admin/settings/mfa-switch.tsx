"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setRequireMfa } from "@/lib/admin/actions/security";

export function MfaSwitch({ initial, readOnly }: { initial: boolean; readOnly: boolean }) {
  const [on, setOn] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">Require two-step sign-in for staff</p>
          <p className="text-sm text-muted-foreground">
            When on, staff enter an authenticator code before the admin area opens. Turning it off is handy during development;
            turn it back on before launch. Customer sign-in isn&apos;t affected.
          </p>
        </div>
        <Switch checked={on} disabled={readOnly || pending} aria-label="Require two-step sign-in for staff"
          onCheckedChange={(next) => {
            if (!next && !confirm("Turn off two-step sign-in for all staff? Anyone with a staff password can then open the admin area.")) return;
            setOn(next);
            start(async () => { const res = await setRequireMfa(next); setMsg(res); if (res.error) setOn(!next); });
          }} />
      </div>
      {readOnly && <p className="text-xs text-muted-foreground">Only owners can change this.</p>}
      {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
    </div>
  );
}
