"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { amountFor, lineOf, money, per, products, type Interval } from "@/lib/billing/catalog";
import type { PlanAnswers } from "@/lib/redial/setup";
import { cn } from "@/lib/utils";
import { Choice } from "./setup-shell";
import { StepActions } from "./step-actions";

// Step 7: Redial Free or a Redial plan. Paid plans go to checkout after the
// review step.
export function PlanStep({ initial, freeMinutes, business }: { initial?: Partial<PlanAnswers>; freeMinutes: number; business: boolean }) {
  const plans = products().filter((p) => p.kind === "plan" && lineOf(p) === "redial");
  const chosenProduct = plans.find((p) => p.prices.some((x) => x.key === initial?.priceKey));
  const [productId, setProductId] = useState<string | null>(chosenProduct?.id ?? (initial?.priceKey === null ? null : business ? "redial_business" : null));
  const [interval, setInterval] = useState<Interval>(chosenProduct?.prices.find((x) => x.key === initial?.priceKey)?.interval ?? "month");
  const [lines, setLines] = useState(initial?.quantity ?? 1);
  const product = plans.find((p) => p.id === productId) ?? null;
  const price = product?.prices.find((x) => x.interval === interval) ?? product?.prices[0] ?? null;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Start free, or pick a plan now. Change it any time in Billing.</p>
      <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border p-1 text-sm">
        {(["month", "year"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={interval === v} onClick={() => setInterval(v)}
            className={cn("rounded-full px-4 py-1.5", interval === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {v === "month" ? "Monthly" : "Annual · 2 months free"}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Plan" className="grid gap-2">
        <Choice selected={productId === null} onSelect={() => setProductId(null)} title="Redial Free · $0" detail={`${freeMinutes} AI screening minutes a month, VIP and block lists, call summaries.`} />
        {plans.map((p) => {
          const pr = p.prices.find((x) => x.interval === interval) ?? p.prices[0];
          return (
            <Choice key={p.id} selected={productId === p.id} onSelect={() => setProductId(p.id)} tag={p.id === "redial_business" && business ? "For you" : undefined}
              title={`${p.name} · ${money(pr.unitAmount ?? 0)}${p.perSeat ? " per line" : ""}${per(pr.interval)}`}
              detail={[p.tagline, p.features?.[0]].filter(Boolean).join(" ")} />
          );
        })}
      </div>
      {product?.perSeat && price && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Lines</span>
          <div className="flex items-center rounded-lg border">
            <Button variant="ghost" size="icon-sm" aria-label="Fewer lines" onClick={() => setLines(Math.max(1, lines - 1))}><Minus /></Button>
            <span className="w-8 text-center tabular-nums">{lines}</span>
            <Button variant="ghost" size="icon-sm" aria-label="More lines" onClick={() => setLines(Math.min(100, lines + 1))}><Plus /></Button>
          </div>
          <span className="font-medium">{money(amountFor(price, lines))}{per(price.interval)}</span>
        </div>
      )}
      <StepActions step={7} values={{ priceKey: price?.key ?? null, quantity: product?.perSeat ? lines : 1 }} />
    </div>
  );
}
