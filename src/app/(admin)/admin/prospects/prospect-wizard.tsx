"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, Plus, Radar, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { mapProspects } from "@/lib/admin/actions/prospects";
import { cn } from "@/lib/utils";

export type WizardCounts = { total: number; lookedUp: number; unplaced: number; hot: number; dnc: number };

const STEPS = ["Add numbers", "Check the list", "Look up carriers", "Work the best fits"] as const;

// A guided walk through prospecting, start to finish. Each step says what to
// do and has the button that does it.
export function ProspectWizard({ counts, onClose, onImport, onAdd, onLookup, manage, canRun }: {
  counts: WizardCounts; onClose: () => void; onImport: () => void; onAdd: () => void; onLookup: () => void; manage: boolean; canRun: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(counts.total ? 1 : 0);
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const done = [counts.total > 0, counts.total > 0, counts.lookedUp > 0, false];

  return (
    <ResponsivePanel open onOpenChange={(o) => !o && onClose()} title="Prospecting, step by step" id="prospects-wizard" defaultWidth={600}
      description="From a list of business numbers to calls worth making."
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft /> Back</Button>
          <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)}>Next <ArrowRight /></Button>
            : <Button onClick={onClose}>Done</Button>}
        </div>
      }>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)} className="flex w-full flex-col items-center gap-1.5 text-center">
              <span className={cn("flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                i === step ? "border-foreground bg-foreground text-background" : done[i] ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
                {done[i] && i !== step ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("text-[11px] leading-tight", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="space-y-3 rounded-xl border p-4 text-sm">
        {step === 0 && (
          <>
            <h3 className="text-base font-semibold">1. Add business numbers</h3>
            <p className="text-muted-foreground">Bring in the businesses you want to call on. A CSV only needs a phone column; business name, website, address, city, state and category help with scoring and the map.</p>
            <p className="text-muted-foreground">Business numbers only. Numbers that can&apos;t be real are skipped, and nothing is charged yet.</p>
            {manage && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={onImport}><Upload /> Import a list</Button>
                <Button variant="outline" onClick={onAdd}><Plus /> Add one business</Button>
              </div>
            )}
            {counts.total > 0 && <p className="text-xs text-emerald-700 dark:text-emerald-300">You have {counts.total} prospects on the list.</p>}
          </>
        )}
        {step === 1 && (
          <>
            <h3 className="text-base font-semibold">2. Check the list</h3>
            <p className="text-muted-foreground">Use search and the filter chips to spot anything that doesn&apos;t belong, then delete it or mark it Do not contact (permanent). The Map view shows where they are; the Calendar view shows when each was added.</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>{counts.total} prospects, {counts.dnc} marked Do not contact.</li>
              <li>{counts.unplaced ? `${counts.unplaced} not on the map yet (they need a city or address).` : "Everything with a city or address is on the map."}</li>
            </ul>
            {manage && counts.unplaced > 0 && (
              <Button variant="outline" disabled={pending} onClick={() => start(async () => { setNote((await mapProspects()).ok); router.refresh(); })}>
                <MapPin /> {pending ? "Placing… (about a second each)" : "Place them on the map"}
              </Button>
            )}
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="text-base font-semibold">3. Look up who carries each number</h3>
            <p className="text-muted-foreground">Twilio tells us the carrier and line type for each number: RingCentral, Cox, Spectrum, other VoIP, a landline, or a cell phone. That fills the Provider column and the score.</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>About $0.008 a number (caller name is $0.01 more, off by default).</li>
              <li>You see the cost and confirm before anything runs. Numbers checked in the last 90 days are free (cached).</li>
              <li>Spending stops at the monthly cap ($25 to start).</li>
            </ul>
            <p className="text-xs text-muted-foreground">{counts.lookedUp} of {counts.total} looked up so far. To check a few first, select them in the table and choose Look up carriers.</p>
            {canRun
              ? <Button disabled={counts.total - counts.lookedUp - counts.dnc <= 0} onClick={onLookup}><Radar /> Look up the rest</Button>
              : <p className="rounded-lg bg-muted/60 p-2 text-xs">Only owners and admins can run lookups.</p>}
          </>
        )}
        {step === 3 && (
          <>
            <h3 className="text-base font-semibold">4. Work the best fits</h3>
            <p className="text-muted-foreground">Start with the <span className="font-medium text-foreground">Score 60+</span> and <span className="font-medium text-foreground">RingCentral confirmed</span> filters. Open a prospect for its talk track, call, add notes, and mark it Contacted.</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>Cox and Spectrum: keep their line, add Redial on top with forwarding. No porting, the easiest yes.</li>
              <li>On a cell phone: the owner answers customers themselves. Redial answers first and texts them.</li>
              <li>Calls by a person and email only. No cold texts, no automated or AI calls.</li>
            </ul>
            <p className="flex items-center gap-2 rounded-lg bg-muted/60 p-2 text-xs"><Send className="size-4 shrink-0" /> Send to Leads (tagged by provider) comes with the lookup update. {counts.hot ? `${counts.hot} prospects score 60+.` : ""}</p>
          </>
        )}
      </div>
    </ResponsivePanel>
  );
}
