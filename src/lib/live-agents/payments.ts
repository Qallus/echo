"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/billing/stripe";
import { getUser, isUuid } from "@/lib/data";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { myLiveAgent } from "./agent-data";
import { engagementLabel } from "./types";

// Money for Live Agents, run as the signed-in person. Businesses pay Redial
// through Stripe Checkout; agents get paid through a Stripe Express account.
// Stripe's webhook records payments (src/app/api/stripe/webhook/route.ts)
// and the scheduled job sends payouts (src/app/api/cron/live-agents).

type Result = { ok?: true; url?: string; error?: string };
const NOT_ON = "Payments aren't switched on yet. Please try again soon.";

// What the business pays now for a booked engagement (cents), and the
// agent-rate part of it. On-demand saves a card instead (billed per minute).
function amountFor(e: { type: string; rate_cents: number; hours: number | null; business_fee_pct: number }) {
  const base = e.type === "shift" ? Math.round(e.rate_cents * Number(e.hours ?? 0)) : e.type === "trial" ? Math.round(e.rate_cents * 0.5) : e.type === "retainer" ? e.rate_cents : 0;
  return { base, total: Math.round(base * (1 + Number(e.business_fee_pct) / 100)) };
}

// Business: pay for an accepted offer (or save a card for on-demand work).
export async function payForEngagement(engagementId: string): Promise<Result> {
  const user = await getUser();
  if (!user) return { error: "Sign in first." };
  if (!isUuid(engagementId)) return { error: "Booking not found." };
  const s = await stripe();
  if (!s) return { error: NOT_ON };
  const supabase = await createClient();
  const { data: e } = await supabase.from("live_agent_engagements")
    .select("id, thread_id, workspace_id, type, status, rate_cents, hours, starts_on, business_fee_pct, live_agent_threads (live_agents (display_name, user_id))")
    .eq("id", engagementId).maybeSingle();
  const agent = (e?.live_agent_threads as unknown as { live_agents: { display_name: string; user_id: string | null } | null } | null)?.live_agents;
  if (!e || !agent) return { error: "Booking not found." };
  if (agent.user_id === user.id) return { error: "The business pays for this booking." };
  if (e.status !== "accepted") return { error: e.status === "active" ? "This booking is already paid." : "Only accepted offers can be paid." };

  // The Stripe customer for this person (created if needed; the webhook saves the link).
  const { data: bc } = await supabase.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  const customer = bc?.stripe_customer_id ?? (await s.customers.create({ email: user.email || undefined, metadata: { echo_user_id: user.id } })).id;
  const origin = await siteOrigin();
  const meta = { echo_user_id: user.id, live_agent_engagement: e.id };
  const back = `${origin}/messages/${e.thread_id}`;

  if (e.type === "on_demand") {
    const session = await s.checkout.sessions.create({
      mode: "setup", customer, currency: "usd", payment_method_types: ["card"], client_reference_id: user.id, metadata: { ...meta, kind: "card" },
      setup_intent_data: { metadata: meta }, success_url: `${back}?paid=1`, cancel_url: back,
    });
    return session.url ? { url: session.url } : { error: "Couldn't start checkout." };
  }

  const { base, total } = amountFor(e);
  if (total < 50) return { error: "That booking is too small to charge." };
  const when = e.starts_on ? ` · ${new Date(`${e.starts_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
  const session = await s.checkout.sessions.create({
    mode: "payment", customer, client_reference_id: user.id,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: total, product_data: { name: `Redial Live Agent: ${engagementLabel(e.type)} with ${agent.display_name}${when}`, description: `Includes Redial's ${Number(e.business_fee_pct)}% service fee.` } } }],
    payment_intent_data: { transfer_group: e.id, metadata: meta, description: `Live Agent booking ${e.id}` },
    metadata: { ...meta, kind: "charge", base_cents: String(base) },
    success_url: `${back}?paid=1`, cancel_url: back,
  });
  return session.url ? { url: session.url } : { error: "Couldn't start checkout." };
}

// Business: report a problem with a paid booking (holds the payout).
export async function disputeEngagement(engagementId: string, note: string, thread?: string): Promise<Result> {
  if (!isUuid(engagementId)) return { error: "Booking not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_dispute", { engagement: engagementId, note: note.slice(0, 2000) });
  if (error) return { error: error.code === "22023" ? error.message : "Couldn't send that. Try again." };
  if (thread) revalidatePath(`/messages/${thread}`);
  revalidatePath("/hiring");
  return { ok: true };
}

// Agent: create (once) a Stripe Express account and open Stripe's
// onboarding: identity, bank or debit card, and tax details.
export async function startPayoutSetup(): Promise<Result> {
  const user = await getUser();
  const agent = await myLiveAgent();
  if (!user || !agent) return { error: "Create your Live Agent profile first." };
  const s = await stripe();
  if (!s) return { error: NOT_ON };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("live_agent_payout_accounts").select("stripe_account_id").eq("agent_id", agent.id).maybeSingle();
  let account = existing?.stripe_account_id ?? null;
  if (!account) {
    try {
      const created = await s.accounts.create({
        type: "express", country: "US", email: user.email || undefined, business_type: "individual",
        capabilities: { transfers: { requested: true } },
        business_profile: { product_description: "Live phone answering for businesses through Redial Live Agents", mcc: "7399" },
        metadata: { echo_user_id: user.id, live_agent_id: agent.id },
      });
      account = created.id;
    } catch (e) {
      console.error("[live agents] connect account", e);
      return { error: "Stripe couldn't create your payout account. Connect may not be switched on yet for Redial." };
    }
    const { error } = await supabase.rpc("live_agent_set_payout_account", { acct: account });
    if (error) return { error: "Couldn't save your payout account. Try again." };
  }
  const origin = await siteOrigin();
  const link = await s.accountLinks.create({
    account, type: "account_onboarding", refresh_url: `${origin}/agent-desk/earnings?refresh=1`, return_url: `${origin}/agent-desk/earnings?return=1`,
  });
  return { url: link.url };
}

// Agent: Stripe's Express dashboard (bank account, payout schedule, tax forms).
export async function openPayoutDashboard() {
  const agent = await myLiveAgent();
  const s = await stripe();
  if (!agent || !s) redirect("/agent-desk/earnings");
  const supabase = await createClient();
  const { data } = await supabase.from("live_agent_payout_accounts").select("stripe_account_id").eq("agent_id", agent.id).maybeSingle();
  if (!data) redirect("/agent-desk/earnings");
  const login = await s.accounts.createLoginLink(data.stripe_account_id);
  redirect(login.url);
}
