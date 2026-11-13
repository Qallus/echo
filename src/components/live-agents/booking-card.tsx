"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InterestButton } from "@/components/live-agents/interest-dialog";
import { feeSplit, money, type Fees, type LiveAgent } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// The profile's sticky booking card: the three ways to book, priced with
// Redial's service fee. Booking opens with payments (a later step); until
// then "Message" reaches the Redial team.

type Plan = "ondemand" | "shifts" | "monthly";

export function BookingCard({ agent: a, fees, name }: { agent: LiveAgent; fees: Fees; name: string }) {
  const plans = [
    a.perMinuteCents != null && { id: "ondemand" as Plan, tab: "On-demand", price: `${money(a.perMinuteCents, { exact: true })}/min`, note: `Billed per connected minute, weekly. Plus ${fees.businessFeePercent}% service fee.` },
    a.hourlyCents != null && { id: "shifts" as Plan, tab: "Shifts", price: `${money(a.hourlyCents)}/hr`, note: "Authorized when you book, charged after the shift." },
    a.retainerCents != null && { id: "monthly" as Plan, tab: "Monthly", price: `${money(a.retainerCents)}/mo`, note: `${a.retainerHours} hours of coverage a month${a.perMinuteCents != null ? `, then ${money(a.perMinuteCents, { exact: true })}/min` : ""}. Cancel any month.` },
  ].filter(Boolean) as { id: Plan; tab: string; price: string; note: string }[];
  const [plan, setPlan] = useState<Plan>(plans[0]?.id ?? "shifts");
  const current = plans.find((p) => p.id === plan) ?? plans[0];
  const trial = a.hourlyCents != null ? feeSplit(Math.round(a.hourlyCents / 2), fees).business : null;

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      {plans.length > 1 && (
        <div className="grid rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }} role="tablist">
          {plans.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={plan === p.id} onClick={() => setPlan(p.id)}
              className={cn("rounded-md px-2 py-1.5 text-sm transition", plan === p.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {p.tab}
            </button>
          ))}
        </div>
      )}
      {current && (
        <div>
          <p className="text-3xl font-semibold">{current.price}</p>
          <p className="mt-1 text-sm text-muted-foreground">{current.note}</p>
        </div>
      )}
      <ul className="space-y-2 text-sm">
        {["Your Redial AI answers first, then transfers", "Listen in, coach or take over any call", "Every call recorded and summarized by Echo", "Pay through Redial; disputes covered for 72 hours"].map((t) => (
          <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {t}</li>
        ))}
      </ul>
      <div className="space-y-2">
        <InterestButton kind="business" className="w-full" agentName={name} source={`/live-agents/${a.handle}`}>Message {name}</InterestButton>
        {trial != null && (
          <Button variant="outline" className="w-full" disabled>Book a 30-min paid trial · {money(trial, { exact: true })} <span className="text-xs text-muted-foreground">(soon)</span></Button>
        )}
      </div>
      <p className="flex gap-2 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" /> Phone numbers and emails stay hidden. Keep messages and payments on Redial to stay covered.</p>
    </div>
  );
}

const AgentsMap = dynamic(() => import("@/components/live-agents/agents-map").then((m) => m.AgentsMap), {
  ssr: false, loading: () => <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />,
});

// One agent's approximate area on the profile page.
export function AreaMap({ agent: a }: { agent: LiveAgent }) {
  if (a.lat == null || a.lng == null) return null;
  return <AgentsMap agents={[{ id: a.id, handle: a.handle, name: a.displayName, lat: a.lat, lng: a.lng, label: `${a.city}, ${a.region}` }]} className="z-0 h-56 w-full overflow-hidden rounded-xl border" />;
}
