"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Radar, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { estimateLookup, processLookup, startLookup } from "@/lib/admin/actions/prospects";
import type { Estimate, RunProgress } from "@/lib/prospects/runner";
import { cn } from "@/lib/utils";

const usd = (cents: number) => `$${(cents / 100).toFixed(cents > 0 && cents < 100 ? 3 : 2)}`;

// Look up who carries each number: see what it costs, confirm, then watch
// the results come in. `ids` null = every prospect not looked up yet.
export function LookupPanel({ ids, label, onClose }: { ids: string[] | null; label: string; onClose: () => void }) {
  const router = useRouter();
  const [callerName, setCallerName] = useState(false);
  const [est, setEst] = useState<Estimate>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState<RunProgress & { cached: number }>();
  const stop = useRef(false);

  useEffect(() => {
    let live = true;
    estimateLookup(ids, callerName).then((r) => { if (!live) return; setEst(r.est); setError(r.error); }).catch(() => live && setError("Couldn't work out the cost."));
    return () => { live = false; };
  }, [ids, callerName]);
  useEffect(() => () => { stop.current = true; }, []);

  const run = async () => {
    setError(undefined);
    setRunning(true);
    const s = await startLookup(ids, callerName);
    if (s.error || !s.runId) { setError(s.error); setRunning(false); return; }
    let p: RunProgress | undefined;
    let tick = 0;
    do {
      const r = await processLookup(s.runId);
      if (r.error || !r.progress) { setError(r.error ?? "Lookup stopped."); break; }
      p = r.progress;
      setProg({ ...p, cached: s.cached ?? 0 });
      if (++tick % 3 === 0) router.refresh();
    } while (!p.done && !stop.current);
    setRunning(false);
    router.refresh();
  };

  const pct = prog && prog.total ? Math.round(((prog.processed + prog.failed) / prog.total) * 100) : prog?.done ? 100 : 0;
  const finished = prog?.done;

  return (
    <ResponsivePanel open onOpenChange={(o) => !o && !running && onClose()} title="Look up carriers" id="prospects-lookup" defaultWidth={520}
      description={`Who carries each number, from Twilio: ${label}.`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" disabled={running} onClick={onClose}>{finished ? "Done" : "Cancel"}</Button>
          {!prog && <Button disabled={running || !est || est.overCap || est.total === 0} onClick={run}><Radar /> {running ? "Starting…" : est?.toLookUp ? `Confirm: ${usd(est.estCents)}` : "Confirm"}</Button>}
        </div>
      }>
      {!prog ? (
        <div className="space-y-4 text-sm">
          {!est && !error && <p className="text-muted-foreground">Working out the cost…</p>}
          {est && (
            <>
              <dl className="divide-y rounded-xl border px-3">
                {([
                  ["Numbers", est.total],
                  ["Already looked up (free)", `${est.cached} (checked in the last ${est.settings.cacheDays} days)`],
                  ["To look up now", est.toLookUp],
                  ["Price per number", `${usd(est.settings.lineTypeCents)}${callerName ? ` + ${usd(est.settings.callerNameCents)} caller name` : ""}`],
                  ["Estimated cost", <span key="c" className="font-semibold">{usd(est.estCents)}</span>],
                  ["Spent this month", `${usd(est.monthSpentCents)} of ${usd(est.capCents)} cap`],
                ] as [string, React.ReactNode][]).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[11rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              <label className="flex items-start gap-3 rounded-xl border p-3">
                <Checkbox checked={callerName} onCheckedChange={(v) => setCallerName(Boolean(v))} className="mt-0.5" />
                <span><span className="font-medium">Also get the caller name</span><span className="block text-xs text-muted-foreground">The business name the phone company has on file (US only). Billed per number even when there&apos;s no name. Usually not needed when your list has business names.</span></span>
              </label>
              {est.overCap && (
                <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive"><TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  This would pass this month&apos;s cap. Pick fewer numbers, or raise the cap in Settings.</p>
              )}
              {est.toLookUp === 0 && est.total > 0 && <p className="text-muted-foreground">Everything here was looked up recently, so this run is free: it just refreshes the scores.</p>}
              <p className="text-xs text-muted-foreground">Business numbers only. Nothing is charged until you confirm.</p>
            </>
          )}
          {error && <p className="text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium">{finished ? "Finished" : "Looking up…"}</span>
              <span className="tabular-nums text-muted-foreground">{prog.processed + prog.failed} of {prog.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full rounded-full transition-all", finished ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ul className="space-y-1 text-muted-foreground">
            <li>{prog.processed} looked up{prog.cached ? `, ${prog.cached} reused from the last ${est?.settings.cacheDays ?? 90} days` : ""}.</li>
            {prog.failed > 0 && <li className="text-destructive">{prog.failed} couldn&apos;t be looked up (not charged).</li>}
            <li>Cost so far: {usd(prog.costCents)}</li>
          </ul>
          {finished && <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" /> Results are in the table: check the Provider and RingCentral / Cox / Spectrum columns.</p>}
          {!finished && <p className="text-xs text-muted-foreground">Keep this open to watch it finish. If you close the page, it carries on in the background within a few minutes.</p>}
          {error && <p className="text-destructive">{error}</p>}
        </div>
      )}
    </ResponsivePanel>
  );
}
