"use client";

import Link from "next/link";
import { useState } from "react";
import { Briefcase, Check, Lock, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCart, useCart } from "@/lib/billing/cart";
import { amountFor, money, per, PRODUCTS, type Interval, type Product } from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

function AddButton({ priceKey, quantity = 1, label = "Add to cart", className }: { priceKey: string; quantity?: number; label?: string; className?: string }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const inCart = cart.some((l) => l.key === priceKey && l.quantity === quantity);
  return (
    <Button className={className} variant={inCart ? "outline" : "default"}
      onClick={() => { addToCart(priceKey, quantity); setAdded(true); setTimeout(() => setAdded(false), 1500); }}>
      {added || inCart ? <><Check /> In cart</> : <><ShoppingCart /> {label}</>}
    </Button>
  );
}

function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border p-1 text-sm">
      {(["month", "year"] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("rounded-full px-4 py-1.5 transition-colors", value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {v === "month" ? "Monthly" : <>Annual <span className={cn("ml-1 text-xs", value === v ? "text-background/70" : "text-emerald-600")}>2 months free</span></>}
        </button>
      ))}
    </div>
  );
}

function SeatPicker({ seats, onChange }: { seats: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Seats</span>
      <div className="flex items-center rounded-lg border">
        <Button variant="ghost" size="icon-sm" aria-label="Fewer seats" onClick={() => onChange(Math.max(1, seats - 1))}><Minus /></Button>
        <input type="number" min={1} max={500} value={seats} aria-label="Seats"
          onChange={(e) => onChange(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          className="w-12 bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <Button variant="ghost" size="icon-sm" aria-label="More seats" onClick={() => onChange(Math.min(500, seats + 1))}><Plus /></Button>
      </div>
    </div>
  );
}

function PlanCard({ product, interval }: { product: Product; interval: Interval }) {
  const [seats, setSeats] = useState(3);
  const price = product.prices.find((p) => p.interval === interval)!;
  const qty = product.perSeat ? seats : 1;
  const total = amountFor(price, qty);
  const Icon = product.perSeat ? Briefcase : Lock;
  return (
    <div className={cn("flex flex-col rounded-2xl border p-6", product.perSeat && "border-foreground shadow-lg")}>
      <div className="flex items-center justify-between">
        <Icon className="size-5" />
        {product.perSeat && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">For teams</span>}
      </div>
      <h3 className="mt-3 text-xl font-semibold">{product.name}</h3>
      <p className="text-sm text-muted-foreground">{product.tagline}</p>
      <p className="mt-5 text-4xl font-semibold tabular-nums">
        {money(product.perSeat ? Math.round(total / qty) : total)}
        <span className="text-base font-normal text-muted-foreground">{product.perSeat ? ` /seat${per(interval)}` : per(interval)}</span>
      </p>
      {product.perSeat && (
        <div className="mt-3 space-y-2">
          <SeatPicker seats={seats} onChange={setSeats} />
          <p className="text-xs text-muted-foreground">
            {money(total)}{per(interval)} for {seats} {seats === 1 ? "seat" : "seats"}. {price.tiers!.map((t, i) => {
              const from = i === 0 ? 1 : (price.tiers![i - 1].upTo ?? 0) + 1;
              return `${t.upTo ? `${from}–${t.upTo}` : `${from}+`}: ${money(t.unitAmount)}`;
            }).join(" · ")}
          </p>
        </div>
      )}
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {product.features?.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>)}
      </ul>
      <AddButton className="mt-6" priceKey={price.key} quantity={qty} label={`Choose ${product.name}`} />
    </div>
  );
}

export function PlanSection() {
  const [interval, setInterval] = useState<Interval>("month");
  return (
    <div className="space-y-8">
      <div className="flex justify-center"><IntervalToggle value={interval} onChange={setInterval} /></div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col rounded-2xl border p-6">
          <h3 className="text-xl font-semibold">Free</h3>
          <p className="text-sm text-muted-foreground">Try Echo on your own calls.</p>
          <p className="mt-5 text-4xl font-semibold">$0</p>
          <ul className="mt-6 flex-1 space-y-2 text-sm">
            {["300 transcription minutes a month", "30 days of history", "Browser recording with notes and flags", "Search and Ask Echo"].map((f) => (
              <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>
            ))}
          </ul>
          <Button className="mt-6" variant="outline" nativeButton={false} render={<Link href="/signup" />}>Start free</Button>
        </div>
        {PRODUCTS.filter((p) => p.kind === "plan").map((p) => <PlanCard key={p.id} product={p} interval={interval} />)}
      </div>
    </div>
  );
}

export function ProductGrid({ kind }: { kind: Product["kind"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PRODUCTS.filter((p) => p.kind === kind).map((p) => {
        const price = p.prices[0];
        return (
          <div key={p.id} className="flex flex-col rounded-xl border p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-medium">{p.name}</h3>
              <span className="shrink-0 font-semibold tabular-nums">{money(price.unitAmount!)}<span className="text-sm font-normal text-muted-foreground">{per(price.interval)}</span></span>
            </div>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.tagline}</p>
            <AddButton className="mt-4 self-start" priceKey={price.key} />
          </div>
        );
      })}
    </div>
  );
}

export function CartButton() {
  const cart = useCart();
  const count = cart.length;
  return (
    <Button variant="ghost" size="icon" className={cn("relative", count > 0 && "mr-1.5")} aria-label={count ? `Cart, ${count} items` : "Cart"} nativeButton={false} render={<Link href="/cart" />}>
      <ShoppingCart className="size-5" />
      {count > 0 && <span className="pointer-events-none absolute -top-1 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] leading-none font-semibold text-background tabular-nums ring-2 ring-background">{count}</span>}
    </Button>
  );
}
