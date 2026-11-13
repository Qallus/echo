import { timingSafeEqual } from "node:crypto";
import { stripe } from "@/lib/billing/stripe";
import { secret } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Live Agents money job (a Coolify scheduled task, hourly):
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://echo.redial.si/api/cron/live-agents
// No user session: CRON_SECRET is checked, then the service role
//   1. completes booked work that has clearly ended (queues payouts, 3-day hold), and
//   2. bills on-demand bookings weekly for answered minutes (1-minute minimum
//      per call) on the business's saved card, and
//   3. sends payouts that are due to each agent's Stripe Express account.
// A payout is only sent when the Stripe account belongs to that agent
// (metadata.echo_user_id) and can receive transfers.

export const maxDuration = 300;

async function authorized(req: Request) {
  const expected = await secret("CRON_SECRET");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || !given) return false;
  const a = Buffer.from(expected), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Due = {
  id: string; engagement_id: string; amount_cents: number; agent_id: string;
  live_agents: { user_id: string | null; live_agent_payout_accounts: { stripe_account_id: string } | null } | null;
  live_agent_payments: { stripe_payment_intent: string | null } | null;
};

type Db = ReturnType<typeof createAdminClient>;
type StripeClient = NonNullable<Awaited<ReturnType<typeof stripe>>>;
const WEEK = 7 * 24 * 3600_000;

async function billOnDemand(db: Db, s: StripeClient) {
  const { data: engs } = await db.from("live_agent_engagements")
    .select("id, rate_cents, business_fee_pct, paid_at, billed_through, live_agent_payments (kind, stripe_customer)")
    .eq("type", "on_demand").eq("status", "active").limit(200);
  type E = { id: string; rate_cents: number; business_fee_pct: number; paid_at: string | null; billed_through: string | null; live_agent_payments: { kind: string; stripe_customer: string | null }[] };
  let n = 0;
  for (const e of (engs ?? []) as unknown as E[]) {
    const since = e.billed_through ?? e.paid_at;
    if (!since || Date.now() - new Date(since).getTime() < WEEK) continue;
    const customer = e.live_agent_payments.find((p) => p.kind === "card" && p.stripe_customer)?.stripe_customer;
    if (!customer) continue;
    const { data: sessions } = await db.from("live_agent_call_sessions").select("id, billable_seconds")
      .eq("engagement_id", e.id).eq("status", "answered").is("payment_id", null).not("ended_at", "is", null);
    if (!sessions?.length) continue;
    const minutes = sessions.reduce((m, x) => m + Math.ceil(Math.max(60, x.billable_seconds) / 60), 0);
    const base = minutes * e.rate_cents;
    const amount = Math.round(base * (1 + Number(e.business_fee_pct) / 100));
    if (amount < 50) continue;
    try {
      const c = await s.customers.retrieve(customer);
      const pm = !c.deleted && c.invoice_settings?.default_payment_method;
      if (!pm) continue;
      const intent = await s.paymentIntents.create({
        amount, currency: "usd", customer, payment_method: typeof pm === "string" ? pm : pm.id, off_session: true, confirm: true,
        transfer_group: e.id, description: `Redial Live Agent: ${minutes} on-demand minutes`,
        metadata: { live_agent_engagement: e.id, minutes: String(minutes) },
      }, { idempotencyKey: `live-agent-bill-${e.id}-${sessions.map((x) => x.id).sort().at(-1)}` });
      if (intent.status !== "succeeded") continue;
      const { error } = await db.rpc("live_agent_bill_minutes", { engagement: e.id, sessions: sessions.map((x) => x.id), pi: intent.id, amount, base });
      if (!error) n++;
    } catch (err) {
      console.error("[live agents] on-demand billing", e.id, err instanceof Error ? err.message : err);
    }
  }
  return n;
}

async function run(req: Request) {
  if (!(await authorized(req))) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  const { data: completed } = await db.rpc("live_agent_auto_complete");

  const s = await stripe();
  if (!s) return Response.json({ ok: true, completed, paid: 0, note: "Stripe not set up" });
  const { data } = await db.from("live_agent_payouts")
    .select("id, engagement_id, amount_cents, agent_id, live_agents (user_id, live_agent_payout_accounts (stripe_account_id)), live_agent_payments (stripe_payment_intent)")
    .eq("status", "pending").lte("available_at", new Date().toISOString()).limit(50);

  const billed = await billOnDemand(db, s);

  let paid = 0, waiting = 0;
  for (const p of (data ?? []) as unknown as Due[]) {
    const acct = p.live_agents?.live_agent_payout_accounts?.stripe_account_id;
    const fail = (failure: string) => db.from("live_agent_payouts").update({ failure }).eq("id", p.id);
    if (!acct) { waiting++; await fail("Waiting for the Live Agent to set up payouts."); continue; }
    if (p.amount_cents <= 0) { await db.from("live_agent_payouts").update({ status: "cancelled", failure: "Nothing to pay." }).eq("id", p.id); continue; }
    try {
      const account = await s.accounts.retrieve(acct);
      if (account.metadata?.echo_user_id !== p.live_agents?.user_id) { await db.from("live_agent_payouts").update({ status: "held", failure: "Payout account doesn't match this agent." }).eq("id", p.id); continue; }
      if (account.capabilities?.transfers !== "active") { waiting++; await fail("The Live Agent hasn't finished payout setup with Stripe."); continue; }
      // Tie the transfer to the business's charge, so it waits for those funds.
      const pi = p.live_agent_payments?.stripe_payment_intent;
      const charge = pi ? (await s.paymentIntents.retrieve(pi)).latest_charge : null;
      const transfer = await s.transfers.create({
        amount: p.amount_cents, currency: "usd", destination: acct, transfer_group: p.engagement_id,
        ...(typeof charge === "string" ? { source_transaction: charge } : {}),
        metadata: { live_agent_payout: p.id, live_agent_engagement: p.engagement_id },
      }, { idempotencyKey: `live-agent-payout-${p.id}` });
      await db.from("live_agent_payouts").update({ status: "paid", stripe_transfer_id: transfer.id, paid_at: new Date().toISOString(), failure: null }).eq("id", p.id);
      paid++;
    } catch (e) {
      await db.from("live_agent_payouts").update({ status: "failed", failure: (e instanceof Error ? e.message : "Transfer failed").slice(0, 500) }).eq("id", p.id);
    }
  }
  return Response.json({ ok: true, completed, billed, paid, waiting });
}

export const GET = run;
export const POST = run;
