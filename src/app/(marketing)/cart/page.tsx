import Link from "next/link";
import { stripeReady } from "@/lib/billing/stripe";
import { CartView } from "./cart-view";

export const metadata = { title: "Cart · Echo", robots: { index: false } };

export default async function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your cart</h1>
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Continue shopping</Link>
      </div>
      <CartView checkoutReady={await stripeReady()} />
    </div>
  );
}
