import Link from "next/link";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { PromoCodes, type PromoRow } from "./promo-codes";

export const metadata = { title: "Billing · Admin · Echo" };

type SubRow = { id: string; user_id: string; user_email: string | null; status: string; items: { price_key: string; quantity: number }[]; current_period_end: string | null; cancel_at_period_end: boolean; created_at: string; updated_at: string };

// Stripe promotion codes (empty until Stripe is connected).
async function promoCodes(): Promise<PromoRow[]> {
  const s = stripe();
  if (!s) return [];
  try {
    const list = await s.promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] });
    return list.data.map((p) => {
      const c = typeof p.promotion?.coupon === "object" ? p.promotion.coupon : null;
      const off = c?.percent_off ? `${c.percent_off}% off` : c?.amount_off ? `${money(c.amount_off, c.currency ?? "usd")} off` : "";
      const length = c?.duration === "forever" ? "forever" : c?.duration === "repeating" ? `for ${c.duration_in_months} months` : "first payment";
      return { id: p.id, code: p.code, active: p.active, redeemed: p.times_redeemed, max: p.max_redemptions, summary: [off, length].filter(Boolean).join(", ") };
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
    promoCodes(),
  ]);
  const o = (orders.data ?? []) as OrderRow[];
  const s = (subs.data ?? []) as SubRow[];
  const monthly = mrr(s);
  const churn = churn30(s);
  const { month: revenueMonth, last30: revenue30 } = revenue(o);
  const live = s.filter((x) => x.status === "active" || x.status === "trialing");
  const pastDue = s.filter((x) => x.status === "past_due");

  return (
    <AdminPage title="Billing" description={stripeReady() ? "Revenue, catalog, orders and subscriptions, from Stripe." : "Stripe isn't connected yet: the catalog can be edited now; orders and revenue appear once checkout is live."}>
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <CatalogEditor products={catalog} stripeReady={stripeReady()} readOnly={!manage} />
        </TabsContent>

        <TabsContent value="orders" className="pt-6">
          <OrdersTable orders={o} canRefund={manage && stripeReady()} />
        </TabsContent>

        <TabsContent value="subscriptions" className="pt-6">
          {s.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No subscriptions yet.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Plan and add-ons</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Monthly value</TableHead><TableHead>Renews</TableHead></TableRow></TableHeader>
              <TableBody>
                {s.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell><Link href={`/admin/users/${x.user_id}`} className="hover:underline">{x.user_email ?? "—"}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{x.items.map((i) => `${findPrice(i.price_key)?.product.name ?? i.price_key}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ")}</TableCell>
                    <TableCell><Badge variant="outline" className={x.status === "past_due" ? "text-destructive" : ""}>{x.status.replace("_", " ")}{x.cancel_at_period_end ? " · ending" : ""}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{money(mrr([{ ...x, status: "active" }]))}</TableCell>
                    <TableCell className="text-muted-foreground">{x.current_period_end ? <LocalDate iso={x.current_period_end} short /> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="codes" className="pt-6">
          {stripeReady() ? <PromoCodes codes={codes} readOnly={!manage} /> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">Promotion codes live in Stripe. Add STRIPE_SECRET_KEY to create them here.</p>}
        </TabsContent>

        <TabsContent value="settings" className="pt-6">
          <BillingSettingsForm initial={settings} readOnly={!manage} />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
