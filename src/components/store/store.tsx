"use client";

import Link from "next/link";
import { useState } from "react";
import { AudioLines, Briefcase, Building2, Check, House, Lock, Mic, Minus, Plus, ShoppingCart, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCart, useCart } from "@/lib/billing/cart";
import { amountFor, lineOf, money, per, products, type Interval, type Line, type Product } from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";
import { Named } from "@/components/marketing/agent-name";

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

// Redial plans are priced per line, Echo plans per seat.
const unitOf = (p: Product) => (lineOf(p) === "redial" ? { one: "line", many: "lines" } : { one: "seat", many: "seats" });

function SeatPicker({ seats, onChange, unit = { one: "seat", many: "seats" } }: { seats: number; onChange: (n: number) => void; unit?: { one: string; many: string } }) {
  const label = unit.many[0].toUpperCase() + unit.many.slice(1);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center rounded-lg border">
        <Button variant="ghost" size="icon-sm" aria-label={`Fewer ${unit.many}`} onClick={() => onChange(Math.max(1, seats - 1))}><Minus /></Button>
        <input type="number" min={1} max={500} value={seats} aria-label={label}
          onChange={(e) => onChange(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          className="w-12 bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <Button variant="ghost" size="icon-sm" aria-label={`More ${unit.many}`} onClick={() => onChange(Math.min(500, seats + 1))}><Plus /></Button>
      </div>
    </div>
  );
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  redial_personal: Lock, redial_business: Briefcase, redial_team: UsersRound, business: Briefcase, redial_home_phone: House, redial_business_phone: Building2,
};

function PlanCard({ product, interval, featured }: { product: Product; interval: Interval; featured?: boolean }) {
  const unit = unitOf(product);
  const [seats, setSeats] = useState(lineOf(product) === "redial" ? 1 : 3);
  const price = product.prices.find((p) => p.interval === interval) ?? product.prices[0];
  const qty = product.perSeat ? seats : 1;
  const total = amountFor(price, qty);
  const Icon = ICONS[product.id] ?? (product.perSeat ? Briefcase : Lock);
  return (
    <div className={cn("flex flex-col rounded-2xl border p-6", featured && "border-foreground shadow-lg")}>
      <div className="flex items-center justify-between">
        <Icon className="size-5" />
        {featured && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">{lineOf(product) === "redial" ? "Most popular" : "For teams"}</span>}
      </div>
      <h3 className="mt-3 text-xl font-semibold">{product.name}</h3>
      <p className="text-sm text-muted-foreground">{product.tagline}</p>
      <p className="mt-5 text-4xl font-semibold tabular-nums">
        {money(product.perSeat ? Math.round(total / qty) : total)}
        <span className="text-base font-normal text-muted-foreground">{product.perSeat ? ` /${unit.one}${per(price.interval)}` : per(price.interval)}</span>
      </p>
      {product.perSeat && (
        <div className="mt-3 space-y-2">
          <SeatPicker seats={seats} onChange={setSeats} unit={unit} />
          <p className="text-xs text-muted-foreground">
            {money(total)}{per(price.interval)} for {seats} {seats === 1 ? unit.one : unit.many}.
            {price.tiers && ` ${price.tiers.map((t, i) => {
              const from = i === 0 ? 1 : (price.tiers![i - 1].upTo ?? 0) + 1;
              return `${t.upTo ? `${from}–${t.upTo}` : `${from}+`}: ${money(t.unitAmount)}`;
            }).join(" · ")}`}
          </p>
        </div>
      )}
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {product.features?.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>)}
      </ul>
      <AddButton className="mt-6" priceKey={price.key} quantity={qty} label={`Choose ${product.name.replace(/^Redial /, "")}`} />
    </div>
  );
}

// A plan that combines Redial and Echo, shown wide under the plans.
function BundleCard({ product, interval }: { product: Product; interval: Interval }) {
  const [lines, setLines] = useState(1);
  const price = product.prices.find((p) => p.interval === interval) ?? product.prices[0];
  const total = amountFor(price, lines);
  return (
    <div className="grid gap-6 rounded-2xl bg-[radial-gradient(120%_90%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] p-6 text-white md:grid-cols-[1fr_auto] md:items-center md:p-8">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-white/60 uppercase"><Sparkles className="size-3.5" /> Bundle</p>
        <h3 className="mt-2 text-2xl font-semibold">{product.name}</h3>
        <p className="mt-1 text-white/70">{product.tagline}</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {product.features?.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>)}
        </ul>
      </div>
      <div className="space-y-3 md:min-w-56 md:text-right">
        <p className="text-4xl font-semibold tabular-nums">{money(price.unitAmount ?? Math.round(total / lines))}<span className="text-base font-normal text-white/60"> /line{per(price.interval)}</span></p>
        <div className="flex items-center gap-2 md:justify-end">
          <span className="text-sm text-white/70">Lines</span>
          <div className="flex items-center rounded-lg border border-white/20">
            <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" aria-label="Fewer lines" onClick={() => setLines(Math.max(1, lines - 1))}><Minus /></Button>
            <span className="w-8 text-center text-sm tabular-nums">{lines}</span>
            <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" aria-label="More lines" onClick={() => setLines(Math.min(500, lines + 1))}><Plus /></Button>
          </div>
        </div>
        <AddButton priceKey={price.key} quantity={lines} label="Choose the bundle" className="w-full bg-white text-neutral-900 hover:bg-white/90 md:w-auto" />
      </div>
    </div>
  );
}

function FreeCard({ title, sub, features }: { title: string; sub: string; features: string[] }) {
  return (
    <div className="flex flex-col rounded-2xl border p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground"><Named text={sub} /></p>
      <p className="mt-5 text-4xl font-semibold">$0</p>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>)}
      </ul>
      <Button className="mt-6" variant="outline" nativeButton={false} render={<Link href="/signup" />}>Start free</Button>
    </div>
  );
}

// The plans of one product line. Redial: Free, its plans, then any bundle.
export function PlanSection({ line = "echo", freeMinutes, interval: fixed }: { line?: Line; freeMinutes?: number; interval?: Interval }) {
  const [own, setInterval] = useState<Interval>("month");
  const interval = fixed ?? own;
  const plans = products().filter((p) => p.kind === "plan" && lineOf(p) === line);
  const bundles = plans.filter((p) => p.echoMinutes);
  const phone = plans.filter((p) => p.phones && !p.echoMinutes);
  const main = plans.filter((p) => !p.echoMinutes && !p.phones);
  const free = line === "redial"
    ? { title: "Redial Free", sub: "Try {agent} on the calls you miss.", features: [`${freeMinutes ?? 10} AI screening minutes a month`, "Forward the calls you miss", "VIP and block lists", "A summary of every call"] }
    : { title: "Free", sub: "Try Echo on your own calls.", features: [`${(freeMinutes ?? 300).toLocaleString()} transcription minutes a month`, "30 days of history", "Browser recording with notes and flags", "Search and Ask Echo"] };
  return (
    <div className="space-y-8">
      {!fixed && <div className="flex justify-center"><IntervalToggle value={interval} onChange={setInterval} /></div>}
      <div className={cn("grid gap-6 md:grid-cols-2", main.length >= 3 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <FreeCard {...free} />
        {main.map((p) => <PlanCard key={p.id} product={p} interval={interval} featured={p.perSeat} />)}
      </div>
      {bundles.map((p) => <BundleCard key={p.id} product={p} interval={interval} />)}
      {phone.length > 0 && (
        <div id="phone-service" className="scroll-mt-24 space-y-4 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold">Phone service</h3>
              <p className="text-sm text-muted-foreground">A full home or business phone line, with desk and cordless phones, and AI screening built in.</p>
            </div>
            <div className="flex gap-4 text-sm">
              <Link href="/home-phone" className="underline underline-offset-4">Home phone</Link>
              <Link href="/business-phone" className="underline underline-offset-4">Business phone</Link>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {phone.map((p) => <PlanCard key={p.id} product={p} interval={interval} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// /pricing: Redial or Echo plans, with one billing period toggle for both.
export function PricingPlans({ initial = "redial", redialFreeMinutes, echoFreeMinutes }: { initial?: Line; redialFreeMinutes: number; echoFreeMinutes: number }) {
  const [line, setLine] = useState<Line>(initial);
  const [interval, setInterval] = useState<Interval>("month");
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4">
        <div role="tablist" aria-label="Product" className="inline-flex rounded-full border bg-muted/40 p-1 text-sm">
          {([{ id: "redial", label: "Redial", icon: AudioLines, hint: "AI call screening" }, { id: "echo", label: "Echo", icon: Mic, hint: "Recordings and transcripts" }] as const).map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={line === t.id} onClick={() => setLine(t.id)}
              className={cn("flex items-center gap-2 rounded-full px-4 py-2 transition-colors", line === t.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <t.icon className="size-4" />{t.label}<span className="hidden text-xs text-muted-foreground sm:inline">· {t.hint}</span>
            </button>
          ))}
        </div>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <PlanSection key={line} line={line} interval={interval} freeMinutes={line === "redial" ? redialFreeMinutes : echoFreeMinutes} />
    </div>
  );
}

export function ProductGrid({ kind }: { kind: Product["kind"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products().filter((p) => p.kind === kind).map((p) => {
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
