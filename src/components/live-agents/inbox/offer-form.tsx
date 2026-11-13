"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendLiveAgentOffer, type OfferInput } from "@/lib/live-agents/message-actions";
import type { Engagement, EngagementType, Side } from "@/lib/live-agents/messages";
import { ENGAGEMENT_TYPES, offerPrice, type Fees } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

export type AgentRates = { perMinuteCents: number | null; hourlyCents: number | null; retainerCents: number | null; retainerHours: number | null };

const dollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(c % 100 ? 2 : 0));

// Send an offer (business) or a counter-offer (agent, `replaces` set).
export function OfferDialog({ open, onOpenChange, thread, side, rates, fees, counter }: {
  open: boolean; onOpenChange: (o: boolean) => void; thread: string; side: Side; rates: AgentRates; fees: Fees; counter?: Engagement | null;
}) {
  const router = useRouter();
  const startType: EngagementType = counter?.type ?? (rates.hourlyCents != null ? "shift" : "on_demand");
  const rateFor = (t: EngagementType) => t === "on_demand" ? dollars(rates.perMinuteCents) : t === "retainer" ? dollars(rates.retainerCents) : dollars(rates.hourlyCents);
  const [f, setF] = useState<OfferInput>({
    type: startType, rate: counter ? dollars(counter.rateCents) : rateFor(startType), hours: counter?.hours != null ? String(counter.hours) : startType === "retainer" ? String(rates.retainerHours ?? "") : "",
    startsOn: counter?.startsOn ?? "", endsOn: counter?.endsOn ?? "", schedule: counter?.schedule ?? "", script: counter?.script ?? "", note: "", replaces: counter?.id,
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (p: Partial<OfferInput>) => setF((x) => ({ ...x, ...p }));
  const pickType = (t: EngagementType) => set({ type: t, rate: rateFor(t) || f.rate, hours: t === "retainer" ? String(rates.retainerHours ?? "") : t === "shift" ? f.hours : "" });

  const cents = Math.round(Number(f.rate || 0) * 100);
  const price = cents > 0 ? offerPrice({ type: f.type, rateCents: cents, hours: f.hours ? Number(f.hours) : null, businessFeePct: fees.businessFeePercent, agentFeePct: fees.agentFeePercent }) : null;
  const unitLabel = f.type === "on_demand" ? "Rate per connected minute" : f.type === "retainer" ? "Price per month" : "Rate per hour";

  const send = () => start(async () => {
    setError(undefined);
    const r = await sendLiveAgentOffer(thread, f);
    if (r.error) return setError(r.error);
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={counter ? "Counter-offer" : "Send an offer"} className="max-h-[90dvh] max-w-xl overflow-y-auto"
        description={counter ? "Suggest different terms. Your counter replaces their offer." : "The Live Agent can accept, decline or counter. Nothing is charged until payments are set up for your workspace."}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kind of work">
            {ENGAGEMENT_TYPES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={f.type === t.id} disabled={Boolean(counter)} onClick={() => pickType(t.id)}
                className={cn("rounded-xl border p-3 text-left text-sm transition disabled:opacity-60", f.type === t.id ? "border-foreground bg-muted/50" : "hover:bg-muted/40")}>
                <span className="block font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.detail}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-sm font-medium">{unitLabel}</span>
              <div className="relative"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input className="pl-6" inputMode="decimal" value={f.rate} onChange={(e) => set({ rate: e.target.value.replace(/[^\d.]/g, "").slice(0, 9) })} /></div>
            </label>
            {(f.type === "shift" || f.type === "retainer") && (
              <label className="block space-y-1.5"><span className="text-sm font-medium">{f.type === "shift" ? "Hours in the shift" : "Hours included each month"}</span>
                <Input inputMode="decimal" value={f.hours} onChange={(e) => set({ hours: e.target.value.replace(/[^\d.]/g, "").slice(0, 6) })} placeholder={f.type === "shift" ? "4" : "40"} /></label>
            )}
            <label className="block space-y-1.5"><span className="text-sm font-medium">{f.type === "shift" || f.type === "trial" ? "Date" : "Starts"}</span>
              <Input type="date" value={f.startsOn} onChange={(e) => set({ startsOn: e.target.value })} /></label>
            {(f.type === "on_demand" || f.type === "retainer") && (
              <label className="block space-y-1.5"><span className="text-sm font-medium">Ends (optional)</span>
                <Input type="date" value={f.endsOn} onChange={(e) => set({ endsOn: e.target.value })} /></label>
            )}
          </div>
          <label className="block space-y-1.5"><span className="text-sm font-medium">When</span>
            <Input value={f.schedule} maxLength={300} onChange={(e) => set({ schedule: e.target.value })} placeholder="e.g. Weekdays 12–1 pm, or after 5 pm and weekends" /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">What they should know</span>
            <Textarea rows={3} maxLength={4000} value={f.script} onChange={(e) => set({ script: e.target.value })} placeholder="How to greet callers, common questions, who to transfer to, what to book." /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Note (optional)</span>
            <Input value={f.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="Anything else about this offer" /></label>

          {price && (
            <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Business pays</span><br /><span className="font-medium">{price.businessTotal ? `${price.businessTotal}${f.type === "retainer" ? "/mo" : ""}` : price.businessRate}</span> <span className="text-xs text-muted-foreground">incl. {fees.businessFeePercent}% fee</span></p>
              <p><span className="text-muted-foreground">Live Agent receives</span><br /><span className="font-medium">{price.agentTotal ? `${price.agentTotal}${f.type === "retainer" ? "/mo" : ""}` : price.agentRate}</span></p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={pending} onClick={send}>{pending ? "Sending…" : side === "agent" || counter ? "Send counter-offer" : "Send offer"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
