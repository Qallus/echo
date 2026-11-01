import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data";
import { money } from "@/lib/billing/catalog";
import { stripe } from "@/lib/billing/stripe";
import { ClearCart } from "./clear-cart";

export const metadata = { title: "Thank you · Echo", robots: { index: false } };

// Reads the order straight from Stripe, so it shows even if the webhook
// hasn't recorded it yet.
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const user = await requireUser();
  const { session_id } = await searchParams;
  const s = stripe();
  const session = s && session_id?.startsWith("cs_")
    ? await s.checkout.sessions.retrieve(session_id, { expand: ["line_items"] }).catch(() => null)
    : null;
  const mine = session && session.client_reference_id === user.id ? session : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 text-center sm:py-24">
      <ClearCart />
      <CircleCheck className="mx-auto size-12 text-emerald-600" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Thank you!</h1>
      <p className="mt-2 text-muted-foreground">
        {mine ? <>Your payment went through. A receipt is on its way to <span className="text-foreground">{mine.customer_details?.email ?? user.email}</span>.</> : "Your order is being confirmed. It'll appear under Orders in a moment."}
      </p>

      {mine?.line_items && (
        <div className="mt-8 rounded-2xl border text-left">
          <ul className="divide-y">
            {mine.line_items.data.map((li) => (
              <li key={li.id} className="flex justify-between gap-4 px-5 py-3 text-sm">
                <span>{li.description}{(li.quantity ?? 1) > 1 && <span className="text-muted-foreground"> × {li.quantity}</span>}</span>
                <span className="tabular-nums">{money(li.amount_total, mine.currency ?? "usd")}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t px-5 py-3 font-semibold">
            <span>Total paid</span><span className="tabular-nums">{money(mine.amount_total ?? 0, mine.currency ?? "usd")}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button nativeButton={false} render={<Link href="/orders" />}>View your orders</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/home" />}>Open Echo</Button>
      </div>
    </div>
  );
}
