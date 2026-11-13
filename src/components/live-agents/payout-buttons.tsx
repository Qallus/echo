"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openPayoutDashboard, startPayoutSetup } from "@/lib/live-agents/payments";

// Start or finish Stripe payout setup (opens Stripe), or open the Express dashboard.
export function PayoutSetupButton({ label }: { label: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <Button disabled={pending} onClick={() => start(async () => {
        setError(undefined);
        const r = await startPayoutSetup();
        if (r.url) window.location.assign(r.url); else setError(r.error);
      })}><Landmark /> {pending ? "Opening Stripe…" : label}</Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PayoutDashboardButton() {
  return <form action={openPayoutDashboard}><Button type="submit" variant="outline"><ExternalLink /> Bank, payout schedule and tax forms</Button></form>;
}
