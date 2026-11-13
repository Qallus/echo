import { timingSafeEqual } from "node:crypto";
import { stripe } from "@/lib/billing/stripe";
import { secret } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Live Agents money job (a Coolify scheduled task, hourly):
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://echo.redial.si/api/cron/live-agents
// No user session: CRON_SECRET is checked, then the service role
//   1. completes booked work that has clearly ended (queues payouts, 3-day hold), and
//   2. sends payouts that are due to each agent's Stripe Express account.
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

async function run(req: Request) {
  if (!(await authorized(req))) return Response.json({ error: "Not allowed." }, { status: 403 });
  const db = createAdminClient();
  const { data: completed } = await db.rpc("live_agent_auto_complete");

  const s = await stripe();
  if (!s) return Response.json({ ok: true, completed, paid: 0, note: "Stripe not set up" });
  const { data } = await db.from("live_agent_payouts")
    .select("id, engagement_id, amount_cents, agent_id, live_agents (user_id, live_agent_payout_accounts (stripe_account_id)), live_agent_payments (stripe_payment_intent)")
    .eq("status", "pending").lte("available_at", new Date().toISOString()).limit(50);

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
  return Response.json({ ok: true, completed, paid, waiting });
}

export const GET = run;
export const POST = run;
