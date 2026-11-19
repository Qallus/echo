import Link from "next/link";
import { Receipt } from "lucide-react";
import { OrdersList } from "@/components/billing/orders-list";
import { Button } from "@/components/ui/button";
import { listOrders } from "@/lib/data";

export const metadata = { title: "Orders · Redial" };

export default async function OrdersPage() {
  const orders = await listOrders();
  return (
    <div className="w-full space-y-6 py-8 sm:py-10 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Purchases and renewals, with receipts.</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/billing" />}>Billing &amp; plan</Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Receipt className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When you buy a plan, bolt-on or pack, the receipt shows up here.</p>
          <Button className="mt-6" nativeButton={false} render={<Link href="/pricing" />}>See plans</Button>
        </div>
      ) : (
        <OrdersList orders={orders} />
      )}
    </div>
  );
}
