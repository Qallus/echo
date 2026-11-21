"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { saveProspectingSettings } from "@/lib/admin/actions/prospects";
import type { ProspectingSettings } from "@/lib/prospects/settings";

export type Unmapped = { carrier: string; count: number };

// Twilio prices, the monthly cap and the cache window, plus carrier names
// that didn't match a provider (add them to src/lib/prospects/carriers.ts).
export function ProspectSettingsPanel({ settings, unmapped, canEdit, onClose }: {
  settings: ProspectingSettings; unmapped: Unmapped[]; canEdit: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    lineType: String(settings.lineTypeCents / 100), callerName: String(settings.callerNameCents / 100),
    cap: String(settings.monthlyCapCents / 100), days: String(settings.cacheDays),
  });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const field = (k: keyof typeof v, label: string, help: string, prefix = "$") => (
    <div className="space-y-1.5">
      <Label htmlFor={`ps-${k}`}>{label}</Label>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <Input id={`ps-${k}`} inputMode="decimal" value={v[k]} disabled={!canEdit} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
  const save = () => {
    const n = (s: string) => Number(s.replace(/[$,\s]/g, ""));
    const next = { lineTypeCents: n(v.lineType) * 100, callerNameCents: n(v.callerName) * 100, monthlyCapCents: Math.round(n(v.cap) * 100), cacheDays: Math.round(n(v.days)) };
    if (Object.values(next).some((x) => !Number.isFinite(x) || x < 0)) { setMsg({ error: "Use numbers only." }); return; }
    start(async () => { const r = await saveProspectingSettings(next); setMsg(r); if (r.ok) router.refresh(); });
  };

  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title="Prospecting settings" id="prospects-settings" defaultWidth={520}
      description="Check Twilio's current Lookup prices in the Twilio console before big runs."
      footer={canEdit ? (
        <div className="flex items-center justify-end gap-2">
          {(msg.ok || msg.error) && <p className={msg.error ? "mr-auto text-sm text-destructive" : "mr-auto text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      ) : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("lineType", "Carrier and line type, per number", "Twilio Line Type Intelligence. $0.008 as of Oct 2026.")}
        {field("callerName", "Caller name, per number", "Twilio Caller Name (US). $0.01 as of Oct 2026.")}
        {field("cap", "Monthly spending cap", "No run can push this month's lookups past this.")}
        {field("days", "Reuse lookups for (days)", "A number checked within this many days isn't paid for again.", "")}
      </div>
      {!canEdit && <p className="text-xs text-muted-foreground">Only owners and admins can change these.</p>}

      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-semibold">Unmapped carriers</h3>
        <p className="text-xs text-muted-foreground">Carrier names Twilio returned that didn&apos;t match a provider. Ask Claude to add them to the carrier list (src/lib/prospects/carriers.ts).</p>
        {unmapped.length ? (
          <ul className="divide-y rounded-xl border text-sm">
            {unmapped.map((u) => <li key={u.carrier} className="flex justify-between gap-3 px-3 py-1.5"><span className="min-w-0 break-words">{u.carrier}</span><span className="tabular-nums text-muted-foreground">{u.count}</span></li>)}
          </ul>
        ) : <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">Nothing unmapped.</p>}
      </div>
    </ResponsivePanel>
  );
}
