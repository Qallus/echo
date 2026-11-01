import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AudioLines, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyProfile, getOrder } from "@/lib/data";
import { money } from "@/lib/billing/catalog";
import { OrderStatusBadge } from "@/components/billing/status-badge";
import { PrintButton } from "./print-button";

export const metadata = { title: "Receipt · Echo" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, me] = await Promise.all([getOrder(id), getMyProfile()]);
  if (!order) notFound();
  const m = (c: number) => money(c, order.currency);
  const date = new Date(order.createdAt).toLocaleDateString("en-US", { dateStyle: "long" });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/orders" />}><ArrowLeft /> Orders</Button>
        <div className="flex flex-wrap gap-2">
          {order.invoicePdf && <Button variant="outline" size="sm" nativeButton={false} render={<a href={order.invoicePdf} target="_blank" rel="noreferrer" />}><Download /> Invoice PDF</Button>}
          {order.receiptUrl && <Button variant="outline" size="sm" nativeButton={false} render={<a href={order.receiptUrl} target="_blank" rel="noreferrer" />}><ExternalLink /> Stripe receipt</Button>}
          <PrintButton />
        </div>
      </div>

      <article className="overflow-hidden rounded-2xl border bg-background print:rounded-none print:border-0">
        <header className="flex items-center justify-between bg-neutral-900 px-6 py-5 text-white sm:px-8">
          <span className="flex items-center gap-2 font-semibold tracking-[0.2em]"><AudioLines className="size-5" /> ECHO</span>
          <span className="text-xs tracking-wide text-white/60">{order.kind === "renewal" ? "RENEWAL RECEIPT" : "RECEIPT"}</span>
        </header>

        <div className="space-y-8 p-6 sm:p-8">
          <div className="flex flex-wrap justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold">Order #{order.number}</h1>
              <p className="text-sm text-muted-foreground">{date}</p>
              <div className="mt-2"><OrderStatusBadge status={order.status} /></div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Billed to</dt><dd>{me.fullName || order.email}</dd>
              {me.company && <><dt className="text-muted-foreground">Company</dt><dd>{me.company}</dd></>}
              <dt className="text-muted-foreground">Email</dt><dd>{order.email ?? me.email}</dd>
              <dt className="text-muted-foreground">From</dt><dd>Qallus LLC (Echo)</dd>
            </dl>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="hidden pb-2 text-right font-medium sm:table-cell">Unit</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className="py-3 pr-3">{i.description}{i.interval && <span className="text-muted-foreground"> · per {i.interval}</span>}</td>
                  <td className="py-3 text-right tabular-nums">{i.quantity}</td>
                  <td className="hidden py-3 text-right tabular-nums sm:table-cell">{i.unitAmount != null ? m(i.unitAmount) : "—"}</td>
                  <td className="py-3 text-right tabular-nums">{m(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{m(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{m(order.discount)}</dd></div>}
            {order.tax > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{m(order.tax)}</dd></div>}
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total paid</dt><dd className="tabular-nums">{m(order.total)}</dd></div>
          </dl>

          <p className="border-t pt-6 text-xs text-muted-foreground">
            Questions about this charge? Email jwaters@qallus.co with your order number. Payments are processed securely by Stripe.
          </p>
        </div>
      </article>
    </div>
  );
}
