"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Section, StatCard } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { savePrice, saveProduct } from "@/lib/admin/actions/billing";
import { fetchTwilioSmsPrice, saveSmsBilling } from "@/lib/admin/actions/sms-billing";
import type { Product } from "@/lib/billing/catalog";
import { cents, costPerText, pricePerText, profitOn, suggestedPrice, type SmsBilling } from "@/lib/sms/pricing";
import { cn } from "@/lib/utils";

// Admin → Billing → SMS billing. Set what a text costs Redial and the markup;
// see the price per text it gives; set each text pack's and monthly plan's
// size and price (with the suggested price at the current settings).

export type SmsMonth = { sent: number; received: number; twilio_cents: number; priced: number; messages: number; lines: number } | null;

const field = "block space-y-1.5 text-sm";
const hint = "block text-xs text-muted-foreground";

export function SmsBillingPanel({ initial, products, month, readOnly }: { initial: SmsBilling; products: Product[]; month: SmsMonth; readOnly: boolean }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const set = (k: keyof SmsBilling) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const live = () => start(async () => {
    const r = await fetchTwilioSmsPrice();
    if (r.error || r.outbound == null) { setMsg({ error: r.error ?? "No price." }); return; }
    setS({ ...s, costPerSegment: r.outbound });
    setMsg({ ok: `Twilio's price now: ${r.outbound.toFixed(4)}¢ a text sent, ${(r.inbound ?? 0).toFixed(4)}¢ received. Save to use it.` });
  });
  const segments = (month?.sent ?? 0) + (month?.received ?? 0);
  const billedValue = segments * pricePerText(initial);

  return (
    <div className="space-y-8">
      <div className="stat-row grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Your cost per text" value={`${costPerText(s).toFixed(3)}¢`} hint="Twilio + carrier fee" />
        <StatCard label="Price per text" value={`${pricePerText(s).toFixed(3)}¢`} hint={`${s.markupPercent}% markup`} />
        <StatCard label="Texts this month" value={segments.toLocaleString()} hint={`${(month?.sent ?? 0).toLocaleString()} sent · ${(month?.received ?? 0).toLocaleString()} received on ${month?.lines ?? 0} lines`} />
        <StatCard label="Twilio cost this month" value={cents(month?.twilio_cents ?? 0)} hint={`Worth ${cents(billedValue)} at your price · ${month?.priced ?? 0} of ${month?.messages ?? 0} priced so far`} />
      </div>

      <Section title="Price per text" description="Every text segment sent or received on a customer's line counts (160 characters; 70 with emoji). Sending pauses when a customer runs out; incoming texts always arrive.">
        <form className="grid max-w-3xl gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); start(async () => setMsg(await saveSmsBilling(s))); }}>
          <fieldset disabled={readOnly} className="contents">
            <label className={field}>
              <span className="font-medium">Twilio price per text (¢)</span>
              <span className="flex gap-2">
                <Input type="number" step="0.0001" min={0} className="max-w-40" value={s.costPerSegment} onChange={set("costPerSegment")} />
                <Button type="button" variant="outline" size="sm" onClick={live} disabled={pending}><RefreshCw /> Use Twilio&apos;s price</Button>
              </span>
              <span className={hint}>What Twilio charges per segment in the US. The button reads it from your Twilio account.</span>
            </label>
            <label className={field}>
              <span className="font-medium">Carrier fee per text (¢)</span>
              <Input type="number" step="0.0001" min={0} className="max-w-40" value={s.carrierFee} onChange={set("carrierFee")} />
              <span className={hint}>US carriers&apos; registered-texting (10DLC) fee; Twilio passes it on. About 0.3¢.</span>
            </label>
            <label className={field}>
              <span className="font-medium">Markup (%)</span>
              <Input type="number" step="0.1" min={0} className="max-w-40" value={s.markupPercent} onChange={set("markupPercent")} />
              <span className={hint}>Added to your cost. 10% to start.</span>
            </label>
            <label className={field}>
              <span className="font-medium">Free texts a month</span>
              <Input type="number" min={0} className="max-w-40" value={s.freeTexts} onChange={set("freeTexts")} />
              <span className={hint}>Every line owner gets these each month before packs or plans are used.</span>
            </label>
            <label className={field}>
              <span className="font-medium">Picture message cost (¢)</span>
              <Input type="number" step="0.0001" min={0} className="max-w-40" value={s.mmsCost} onChange={set("mmsCost")} />
              <span className={hint}>For reference while picture messages aren&apos;t sold separately.</span>
            </label>
            <label className={field}>
              <span className="font-medium">Stripe fee</span>
              <span className="flex items-center gap-2">
                <Input type="number" step="0.1" min={0} className="max-w-24" value={s.stripePercent} onChange={set("stripePercent")} aria-label="Stripe percent" /> % +
                <Input type="number" min={0} className="max-w-24" value={s.stripeFixedCents} onChange={set("stripeFixedCents")} aria-label="Stripe fixed cents" /> ¢
              </span>
              <span className={hint}>Covered in suggested pack and plan prices, so the markup is what you keep.</span>
            </label>
          </fieldset>
          {!readOnly && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={pending}>Save</Button>
              {(msg.ok || msg.error) && <span className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</span>}
            </div>
          )}
        </form>
      </Section>

      <Section title="Text packs and monthly plans" description="Packs are pay as you go and last 12 months. Monthly plans add texts to any Redial plan and reset each month. Changes update Stripe.">
        <div className="space-y-3">
          {products.length === 0 && <p className="text-sm text-muted-foreground">No text packs yet. Run the SMS billing SQL.</p>}
          {products.map((p) => <PackRow key={p.id} product={p} settings={s} readOnly={readOnly} />)}
        </div>
      </Section>
    </div>
  );
}

function PackRow({ product, settings, readOnly }: { product: Product; settings: SmsBilling; readOnly: boolean }) {
  const price = product.prices[0];
  const [count, setCount] = useState(product.minutes ?? 0);
  const [amount, setAmount] = useState(((price?.unitAmount ?? 0) / 100).toFixed(2));
  const [active, setActive] = useState(product.active !== false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const priceCents = Math.round(Number(amount) * 100);
  const suggested = suggestedPrice(count, settings);
  const profit = profitOn(count, priceCents, settings);
  const save = () => start(async () => {
    const a = await saveProduct(product.id, { name: product.name, tagline: product.tagline, features: product.features ?? [], minutes: count, active });
    if (a.error) { setMsg(a); return; }
    setMsg(price ? await savePrice(price.key, { unitAmount: priceCents, active }) : a);
  });

  return (
    <div className="grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
      <div className="min-w-0">
        <p className="font-medium">{product.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">{product.kind === "pack" ? "Pack · 12 months" : "Monthly plan"}</Badge>
          {cents(priceCents / Math.max(count, 1), 3)} a text
        </p>
      </div>
      <label className="space-y-1 text-xs"><span className="text-muted-foreground">Texts</span>
        <Input type="number" min={1} value={count} disabled={readOnly} onChange={(e) => setCount(Number(e.target.value))} />
      </label>
      <label className="space-y-1 text-xs"><span className="text-muted-foreground">Price ($){price?.interval ? ` per ${price.interval}` : ""}</span>
        <Input type="number" step="0.01" min={0} value={amount} disabled={readOnly} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="space-y-1 text-xs">
        <span className="text-muted-foreground">Suggested {cents(suggested)}</span>
        <p className={cn("text-sm font-medium", profit < 0 ? "text-destructive" : "")}>You keep {cents(profit)}</p>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAmount((suggested / 100).toFixed(2))}>Use suggested</Button>
          <label className="flex items-center gap-1.5 text-xs"><Switch checked={active} onCheckedChange={setActive} /> On sale</label>
          <Button type="button" size="sm" disabled={pending} onClick={save}>Save</Button>
        </div>
      )}
      {(msg.ok || msg.error) && <p className={cn("text-xs sm:col-span-5", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}
    </div>
  );
}
