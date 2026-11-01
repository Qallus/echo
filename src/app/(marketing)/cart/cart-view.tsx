"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Lock, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/billing/actions";
import { removeFromCart, setQuantity, useCart } from "@/lib/billing/cart";
import { amountFor, findPrice, KIND_LABEL, money, per } from "@/lib/billing/catalog";

export function CartView({ checkoutReady }: { checkoutReady: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const lines = cart.map((l) => ({ ...l, hit: findPrice(l.key)! })).filter((l) => l.hit);
  const amount = (l: (typeof lines)[number]) => amountFor(l.hit.price, l.quantity);
  const dueToday = lines.reduce((n, l) => n + amount(l), 0);
  const monthly = lines.filter((l) => l.hit.price.interval === "month").reduce((n, l) => n + amount(l), 0);
  const yearly = lines.filter((l) => l.hit.price.interval === "year").reduce((n, l) => n + amount(l), 0);
  const hasPlan = lines.some((l) => l.hit.product.kind === "plan");
  const hasBoltOn = lines.some((l) => l.hit.product.kind === "bolt_on");

  const checkout = () => start(async () => {
    setError(undefined);
    const res = await startCheckout(cart);
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
                <p className="truncate text-sm text-muted-foreground">{l.hit.product.tagline}</p>
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
          <div className="flex justify-between"><dt className="text-muted-foreground">Due today</dt><dd className="font-semibold tabular-nums">{money(dueToday)}</dd></div>
          {monthly > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Then monthly</dt><dd className="tabular-nums">{money(monthly)}/mo</dd></div>}
          {yearly > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Then yearly</dt><dd className="tabular-nums">{money(yearly)}/yr</dd></div>}
        </dl>
        <p className="text-xs text-muted-foreground">Taxes, if any, are added at checkout. Promo codes can be entered on the next page.</p>
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
