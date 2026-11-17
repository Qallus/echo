"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Loader2, Lock, Minus, Plus, ShoppingCart, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewPromo, startCheckout } from "@/lib/billing/actions";
import { removeFromCart, setQuantity, useCart } from "@/lib/billing/cart";
import { amountFor, findPrice, KIND_LABEL, lineOf, money, per } from "@/lib/billing/catalog";
import { PICK_KEY } from "@/components/numbers/keypad";

// The number picked on /numbers (kept in this browser).
const readPick = () => { try { return localStorage.getItem(PICK_KEY); } catch { return null; } };
const subscribePick = (fn: () => void) => { window.addEventListener("storage", fn); return () => window.removeEventListener("storage", fn); };

export function CartView({ checkoutReady }: { checkoutReady: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; label: string; discount: number; sig: string } | null>(null);
  const [codeError, setCodeError] = useState<string>();
  const [checking, check] = useTransition();
  // A code is checked against this exact cart; changing the cart asks for it again.
  const sig = JSON.stringify(cart);
  const promo = applied?.sig === sig ? applied : null;

  const lines = cart.map((l) => ({ ...l, hit: findPrice(l.key)! })).filter((l) => l.hit);
  const amount = (l: (typeof lines)[number]) => amountFor(l.hit.price, l.quantity);
  const dueToday = lines.reduce((n, l) => n + amount(l), 0);
  const monthly = lines.filter((l) => l.hit.price.interval === "month").reduce((n, l) => n + amount(l), 0);
  const yearly = lines.filter((l) => l.hit.price.interval === "year").reduce((n, l) => n + amount(l), 0);
  const hasPlan = lines.some((l) => l.hit.product.kind === "plan");
  const hasBoltOn = lines.some((l) => l.hit.product.kind === "bolt_on" && l.hit.product.id !== "redial_number");
  // A phone number in the cart: the one picked on /numbers ($2.50/mo with a Redial plan, applied at checkout).
  const numberLine = lines.find((l) => l.hit.product.id === "redial_number");
  const pickRaw = useSyncExternalStore(subscribePick, readPick, () => null);
  const pick = (() => { try { return pickRaw ? (JSON.parse(pickRaw) as { number: string; display: string; place: string | null }) : null; } catch { return null; } })();
  const redialPlan = lines.some((l) => l.hit.product.kind === "plan" && lineOf(l.hit.product) === "redial");

  const apply = () => check(async () => {
    setCodeError(undefined);
    const res = await previewPromo(cart, code);
    if (res.ok) { setApplied({ code: res.code, label: res.label, discount: res.discount, sig }); setCode(""); }
    else setCodeError(res.error);
  });

  const checkout = () => start(async () => {
    setError(undefined);
    if (numberLine && !pick) { setError("Pick your phone number first."); return; }
    const res = await startCheckout(cart, promo?.code, { phoneNumber: pick?.number ?? null });
    if (res.needLogin) router.push("/login?next=/cart");
    else if (res.url) window.location.href = res.url;
    else setError(res.error);
  });

  if (!lines.length) {
    return (
      <div className="rounded-2xl border border-dashed py-20 text-center">
        <ShoppingCart className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">Pick a plan, bolt-ons, minute packs or services.</p>
        <Button className="mt-6" nativeButton={false} render={<Link href="/pricing" />}>Browse plans and add-ons</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y rounded-2xl border">
        {lines.map((l) => {
          const fixedQty = l.hit.product.kind === "bolt_on" || (l.hit.product.kind === "plan" && !l.hit.product.perSeat);
          return (
            <li key={l.key} className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{KIND_LABEL[l.hit.product.kind].replace(/s$/, "")}</p>
                <p className="font-medium">{l.hit.product.name}{l.hit.price.interval && <span className="font-normal text-muted-foreground"> · billed {l.hit.price.interval === "month" ? "monthly" : "annually"}</span>}</p>
                {l.hit.product.id === "redial_number" ? (
                  <p className="text-sm">
                    {pick ? <><span className="font-semibold tabular-nums">{pick.display}</span>{pick.place ? <span className="text-muted-foreground"> · {pick.place}</span> : null} <Link href="/numbers" className="text-xs underline underline-offset-2">Change</Link></>
                      : <Link href="/numbers" className="font-medium text-amber-700 underline underline-offset-2 dark:text-amber-400">Pick your number</Link>}
                    <span className="block text-xs text-muted-foreground">{redialPlan ? "$2.50/mo with your Redial plan (applied at checkout)." : "$5/mo, or $2.50/mo with a Redial plan (applied at checkout)."}</span>
                  </p>
                ) : <p className="truncate text-sm text-muted-foreground">{l.hit.product.tagline}</p>}
              </div>
              {!fixedQty && (
                <div className="flex items-center rounded-lg border" aria-label={l.hit.product.perSeat ? "Seats" : "Quantity"}>
                  <Button variant="ghost" size="icon-sm" aria-label="Decrease" onClick={() => setQuantity(l.key, l.quantity - 1)} disabled={l.quantity <= 1}><Minus /></Button>
                  <span className="w-10 text-center text-sm tabular-nums">{l.quantity}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Increase" onClick={() => setQuantity(l.key, l.quantity + 1)}><Plus /></Button>
                </div>
              )}
              <div className="w-24 text-right">
                <p className="font-semibold tabular-nums">{money(amount(l))}</p>
                {l.hit.price.interval && <p className="text-xs text-muted-foreground">{per(l.hit.price.interval).slice(1)}</p>}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${l.hit.product.name}`} onClick={() => removeFromCart(l.key)}><Trash2 /></Button>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit space-y-4 rounded-2xl border p-5 lg:sticky lg:top-24">
        <h2 className="font-semibold">Summary</h2>
        <dl className="space-y-2 text-sm">
          {promo && <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>Discount ({promo.code})</dt><dd className="tabular-nums">−{money(promo.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">Due today</dt><dd className="font-semibold tabular-nums">{money(Math.max(0, dueToday - (promo?.discount ?? 0)))}</dd></div>
          {monthly > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Then monthly</dt><dd className="tabular-nums">{money(monthly)}/mo</dd></div>}
          {yearly > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Then yearly</dt><dd className="tabular-nums">{money(yearly)}/yr</dd></div>}
        </dl>
        {promo ? (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <Tag className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{promo.label}</span>
            <button type="button" className="shrink-0 rounded p-0.5 hover:bg-emerald-500/20" aria-label="Remove code" onClick={() => setApplied(null)}><X className="size-3.5" /></button>
          </div>
        ) : (
          <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); if (code.trim()) apply(); }}>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" aria-label="Promo code" maxLength={40} className="uppercase" />
              <Button type="submit" variant="outline" disabled={checking || !code.trim() || !checkoutReady}>{checking ? <Loader2 className="animate-spin" /> : "Apply"}</Button>
            </div>
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            {applied && !promo && <p className="text-xs text-muted-foreground">Your cart changed. Apply {applied.code} again.</p>}
          </form>
        )}
        <p className="text-xs text-muted-foreground">Taxes, if any, are added at checkout.{promo ? " The final discount is confirmed on the next page." : ""}</p>
        {hasBoltOn && !hasPlan && <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">Bolt-ons work with a paid plan. Add Pro or Business if you don&apos;t have one yet.</p>}
        <Button className="w-full" size="lg" disabled={pending || !checkoutReady} onClick={checkout}>
          {pending ? <Loader2 className="animate-spin" /> : <Lock />} {checkoutReady ? "Checkout" : "Checkout opens soon"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">Secure payment by Stripe. By checking out you agree to the <Link href="/terms" className="underline">Terms</Link>.</p>
      </aside>
    </div>
  );
}
