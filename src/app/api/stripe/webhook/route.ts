import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/billing/stripe";
import { sendOrderEmail } from "@/lib/billing/emails";
import { secret as getSecret } from "@/lib/secrets";

// Stripe -> Echo. Verified by Stripe's signature (STRIPE_WEBHOOK_SECRET); no
// user session, so it writes with the service-role client. Every handler is
// idempotent because Stripe retries deliveries.
//
// Events to enable: checkout.session.completed, invoice.paid,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted, charge.refunded

type Db = ReturnType<typeof createAdminClient>;
const id = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

async function userForCustomer(db: Db, customer: string | null) {
  if (!customer) return null;
  const { data } = await db.from("billing_customers").select("user_id").eq("stripe_customer_id", customer).maybeSingle();
  return data?.user_id ?? null;
}

async function saveCustomer(db: Db, s: Stripe, userId: string, customer: string | null) {
  if (!customer) return;
  await db.from("billing_customers").upsert({ user_id: userId, stripe_customer_id: customer }, { onConflict: "user_id" });
  await s.customers.update(customer, { metadata: { echo_user_id: userId } }).catch(() => {});
}

type Line = { price_key: string | null; description: string; quantity: number; unit_amount: number | null; amount: number; interval: "month" | "year" | null };

async function insertOrder(db: Db, order: Record<string, unknown>, lines: Line[]) {
  const { data, error } = await db.from("orders").insert(order).select("*").single();
  if (error) {
    if (error.code === "23505") return null; // already recorded
    throw new Error(error.message);
  }
  if (lines.length) await db.from("order_items").insert(lines.map((l) => ({ ...l, order_id: data.id })));
  // Bell notification; the receipt email is sent separately below.
  await db.from("notifications").insert({
    user_id: data.user_id, type: "order_paid", title: `Order #${data.number} confirmed`,
    body: "Thanks! Your receipt is ready.", url: `/orders/${data.id}`, data: { order_id: data.id },
  });
  return data;
}

async function onCheckoutCompleted(db: Db, s: Stripe, session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.echo_user_id;
  if (!userId) return;
  await saveCustomer(db, s, userId, id(session.customer));

  const items = await s.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price"] });
  const invoiceId = id(session.invoice);
  const invoice = invoiceId ? await s.invoices.retrieve(invoiceId) : null;
  let receipt: string | null = invoice?.hosted_invoice_url ?? null;
  const pi = id(session.payment_intent);
  if (!receipt && pi) {
    const intent = await s.paymentIntents.retrieve(pi, { expand: ["latest_charge"] });
    receipt = (intent.latest_charge as Stripe.Charge | null)?.receipt_url ?? null;
  }

  const lines: Line[] = items.data.map((li) => ({
    price_key: li.price?.lookup_key ?? null,
    description: li.description ?? "Item",
    quantity: li.quantity ?? 1,
    unit_amount: li.quantity ? Math.round(li.amount_subtotal / li.quantity) : null,
    amount: li.amount_subtotal,
    interval: (li.price?.recurring?.interval as "month" | "year" | undefined) ?? null,
  }));

  const order = await insertOrder(db, {
    user_id: userId,
    kind: "checkout",
    status: session.payment_status === "paid" || session.payment_status === "no_payment_required" ? "paid" : "open",
    email: session.customer_details?.email ?? null,
    currency: session.currency ?? "usd",
    subtotal: session.amount_subtotal ?? 0,
    discount: session.total_details?.amount_discount ?? 0,
    tax: session.total_details?.amount_tax ?? 0,
    total: session.amount_total ?? 0,
    stripe_checkout_session_id: session.id,
    stripe_invoice_id: invoiceId,
    stripe_payment_intent_id: pi,
    receipt_url: receipt,
    invoice_pdf: invoice?.invoice_pdf ?? null,
  }, lines);
  if (order) await sendOrderEmail(order, lines);
}

// Renewals (and seat changes billed later). The first invoice of a new
// subscription is recorded by checkout.session.completed instead.
async function onInvoicePaid(db: Db, s: Stripe, invoice: Stripe.Invoice) {
  if (invoice.billing_reason === "subscription_create" || !invoice.id) return;
  const userId = invoice.metadata?.echo_user_id ?? (await userForCustomer(db, id(invoice.customer)));
  if (!userId || !invoice.amount_paid) return;
  const lines: Line[] = invoice.lines.data.map((l) => ({
    price_key: (l as unknown as { price?: { lookup_key?: string } }).price?.lookup_key ?? null,
    description: l.description ?? "Subscription",
    quantity: l.quantity ?? 1,
    unit_amount: l.quantity ? Math.round(l.amount / l.quantity) : null,
    amount: l.amount,
    interval: null,
  }));
  const order = await insertOrder(db, {
    user_id: userId,
    kind: "renewal",
    status: "paid",
    email: invoice.customer_email,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    discount: (invoice.total_discount_amounts ?? []).reduce((n, d) => n + d.amount, 0),
    tax: invoice.total - (invoice.total_excluding_tax ?? invoice.total),
    total: invoice.amount_paid,
    stripe_invoice_id: invoice.id,
    receipt_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
  }, lines);
  if (order) await sendOrderEmail(order, lines);
}

async function onSubscription(db: Db, sub: Stripe.Subscription) {
  const userId = sub.metadata?.echo_user_id ?? (await userForCustomer(db, id(sub.customer)));
  if (!userId) return;
  const first = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEnd = first?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  await db.from("subscriptions").upsert({
    id: sub.id,
    user_id: userId,
    status: sub.status,
    items: sub.items.data.map((i) => ({ price_key: i.price.lookup_key, quantity: i.quantity ?? 1 })),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  });
}

async function onRefund(db: Db, charge: Stripe.Charge) {
  const pi = id(charge.payment_intent);
  if (!pi) return;
  await db.from("orders")
    .update({ status: charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded" })
    .eq("stripe_payment_intent_id", pi);
}

export async function POST(req: NextRequest) {
  const s = await stripe();
  const secret = await getSecret("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");
  if (!s || !secret || !signature) return new NextResponse("Not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new NextResponse("Bad signature", { status: 400 });
  }

  const db = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await onCheckoutCompleted(db, s, event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(db, s, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscription(db, event.data.object);
        break;
      case "charge.refunded":
        await onRefund(db, event.data.object);
        break;
    }
  } catch (e) {
    console.error("stripe webhook", event.type, e);
    return new NextResponse("Handler failed", { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
