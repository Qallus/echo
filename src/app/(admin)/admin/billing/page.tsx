import Link from "next/link";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { findPrice, money } from "@/lib/billing/catalog";
import { loadCatalog, loadFullCatalog } from "@/lib/billing/catalog-server";
import { churn30, mrr, revenue } from "@/lib/billing/metrics";
import { getBillingSettings } from "@/lib/billing/settings";
import { stripe, stripeReady } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { BillingSettingsForm } from "./billing-settings-form";
import { CatalogEditor } from "./catalog-editor";
import { OrdersTable, type OrderRow } from "./orders-table";
import { PromoCodes } from "./promo-codes";
import { SubscriptionsList } from "./subscriptions-list";
import { toPromoRow } from "@/lib/billing/promo";
import type { PromoRow } from "@/lib/billing/promo-rules";

export const metadata = { title: "Billing · Admin · Redial" };

type SubRow = { id: string; user_id: string; user_email: string | null; status: string; items: { price_key: string; quantity: number }[]; current_period_end: string | null; cancel_at_period_end: boolean; created_at: string; updated_at: string };

// Stripe promotion codes (empty until Stripe is connected), with what each
// has given away on orders so far.
async function promoCodes(supabase: Awaited<ReturnType<typeof createClient>>): Promise<PromoRow[]> {
  const s = await stripe();
  if (!s) return [];
  try {
    const list = await s.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
    const ids = list.data.map((p) => p.id);
    const { data: used } = ids.length
      ? await supabase.from("orders").select("promo_code_id, discount").in("promo_code_id", ids).in("status", ["paid", "partially_refunded"])
      : { data: [] };
    return list.data.map((p) => {
      const mine = (used ?? []).filter((o) => o.promo_code_id === p.id);
      return { ...toPromoRow(p), given: mine.reduce((n, o) => n + (o.discount ?? 0), 0), orders: mine.length };
    });
  } catch {
    return [];
  }
}

// Revenue, the store catalog, orders and refunds, subscriptions, promotion
// codes and billing settings.
export default async function AdminBillingPage() {
  const staff = await requireStaff("billing.view");
  const manage = can(staff, "billing.manage");
  const supabase = await createClient();
  await loadCatalog();
  const [catalog, orders, subs, settings, codes] = await Promise.all([
    loadFullCatalog(supabase),
    supabase.rpc("admin_orders", { max_rows: 300 }),
    supabase.rpc("admin_subscriptions"),
    getBillingSettings(supabase),
    promoCodes(supabase),
  ]);
  const o = (orders.data ?? []) as OrderRow[];
  const s = (subs.data ?? []) as SubRow[];
  const monthly = mrr(s);
  const churn = churn30(s);
  const { month: revenueMonth, last30: revenue30 } = revenue(o);
  const connected = await stripeReady();
  const live = s.filter((x) => x.status === "active" || x.status === "trialing");
  const pastDue = s.filter((x) => x.status === "past_due");

  return (
    <AdminPage title="Billing" description={connected ? "Revenue, catalog, orders and subscriptions, from Stripe." : "Stripe isn't connected yet: the catalog can be edited now; orders and revenue appear once checkout is live."}>
      <Tabs defaultValue="overview">
        <TabsList variant="line" className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="codes">Promo codes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 pt-6">
          <div className="stat-row grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="MRR" value={money(monthly)} hint={`ARR ${money(monthly * 12)}`} />
            <StatCard label="Active subscriptions" value={live.length} hint={pastDue.length ? `${pastDue.length} past due` : "None past due"} />
            <StatCard label="Revenue this month" value={money(revenueMonth)} hint={`${money(revenue30)} in the last 30 days`} />
            <StatCard label="Churn (30 days)" value={churn == null ? "—" : `${(churn * 100).toFixed(1)}%`} hint="Cancelled ÷ subscribed" />
          </div>
          {pastDue.length > 0 && (
            <Section title="Failed payments" description="Stripe retries these automatically; the customer can update their card in the billing portal.">
              <ul className="divide-y rounded-xl border text-sm">
                {pastDue.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 p-3">
                    <Link href={`/admin/users/${x.user_id}`} className="flex-1 hover:underline">{x.user_email}</Link>
                    <span className="text-muted-foreground">{x.items.map((i) => findPrice(i.price_key)?.product.name ?? i.price_key).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="pt-6">
          <CatalogEditor products={catalog} stripeReady={connected} readOnly={!manage} />
        </TabsContent>

        <TabsContent value="orders" className="pt-6">
          <OrdersTable orders={o} canRefund={manage && connected} />
        </TabsContent>

        <TabsContent value="subscriptions" className="pt-6">
          <SubscriptionsList subs={s.map((x) => ({
            id: x.id, user_id: x.user_id, user_email: x.user_email, status: x.status, current_period_end: x.current_period_end, cancel_at_period_end: x.cancel_at_period_end, created_at: x.created_at,
            plan: x.items.map((i) => `${findPrice(i.price_key)?.product.name ?? i.price_key}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", "),
            monthly: mrr([{ ...x, status: "active" }]),
          }))} />
        </TabsContent>

        <TabsContent value="codes" className="pt-6">
          {connected ? <PromoCodes codes={codes} readOnly={!manage} products={catalog.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))} /> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">Promotion codes live in Stripe. Add your Stripe secret key in Settings → Integrations to create them here.</p>}
        </TabsContent>

        <TabsContent value="settings" className="pt-6">
          <BillingSettingsForm initial={settings} readOnly={!manage} />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
