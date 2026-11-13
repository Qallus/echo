import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PayoutDashboardButton, PayoutSetupButton } from "@/components/live-agents/payout-buttons";
import { stripe } from "@/lib/billing/stripe";
import { requireUser } from "@/lib/data";
import { myLiveAgent } from "@/lib/live-agents/agent-data";
import { money } from "@/lib/live-agents/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Earnings and payouts · Agent Desk" };

const STATUS: Record<string, { label: string; tone: "outline" | "secondary" | "success" | "destructive" }> = {
  pending: { label: "On hold (3 days)", tone: "secondary" }, held: { label: "Held for review", tone: "destructive" }, paid: { label: "Paid", tone: "success" },
  failed: { label: "Retrying", tone: "outline" }, cancelled: { label: "Cancelled", tone: "outline" },
};

// A Live Agent's money: payout setup with Stripe, what's on hold, and what's been paid.
export default async function EarningsPage() {
  await requireUser();
  const agent = await myLiveAgent();
  if (!agent) redirect("/agent-desk");
  const supabase = await createClient();
  const [{ data: acct }, { data: payouts }] = await Promise.all([
    supabase.from("live_agent_payout_accounts").select("stripe_account_id").eq("agent_id", agent.id).maybeSingle(),
    supabase.from("live_agent_payouts").select("id, amount_cents, status, available_at, paid_at, failure, created_at, live_agent_engagements (type, live_agent_threads (business_name))").order("created_at", { ascending: false }).limit(100),
  ]);

  // Live status from Stripe (never stored, so it can't be faked).
  const s = await stripe();
  let ready = false, submitted = false, due: string[] = [];
  if (s && acct) {
    const a = await s.accounts.retrieve(acct.stripe_account_id).catch(() => null);
    ready = a?.capabilities?.transfers === "active" && Boolean(a?.payouts_enabled);
    submitted = Boolean(a?.details_submitted);
    due = a?.requirements?.currently_due ?? [];
  }
  type P = { id: string; amount_cents: number; status: string; available_at: string; paid_at: string | null; failure: string | null; created_at: string; live_agent_engagements: { type: string; live_agent_threads: { business_name: string } | null } | null };
  const rows = (payouts ?? []) as unknown as P[];
  const sum = (st: string[]) => rows.filter((r) => st.includes(r.status)).reduce((n, r) => n + r.amount_cents, 0);
  const day = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Link href="/agent-desk" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Agent Desk</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Earnings and payouts</h1>
        <p className="text-sm text-muted-foreground">Businesses pay Redial up front. When work is done, your share is held for 3 days in case of a problem, then sent to your bank through Stripe.</p>
      </div>

      <section className="space-y-3 rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          {ready ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{ready ? "Payouts are set up" : acct ? (submitted ? "Stripe is checking your details" : "Finish payout setup") : "Set up payouts"}</p>
            <p className="text-sm text-muted-foreground">
              {ready ? "Payouts go to the bank account or debit card you added in Stripe."
                : "Stripe verifies your identity and collects your bank or debit card and tax details. Redial never sees them."}
              {!ready && due.length > 0 && ` Stripe still needs ${due.length} item${due.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ready && <PayoutSetupButton label={acct ? "Continue with Stripe" : "Set up payouts with Stripe"} />}
          {acct && <PayoutDashboardButton />}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[{ l: "On hold", v: sum(["pending", "failed"]) }, { l: "Held for review", v: sum(["held"]) }, { l: "Paid out", v: sum(["paid"]) }].map((x) => (
          <div key={x.l} className="rounded-2xl border p-4"><p className="text-xs text-muted-foreground">{x.l}</p><p className="mt-1 text-2xl font-semibold">{money(x.v, { exact: true })}</p></div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Payouts</h2>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No payouts yet. They appear here when booked work is complete.</p> : (
          <ul className="divide-y rounded-2xl border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.live_agent_engagements?.live_agent_threads?.business_name ?? "Business"}</p>
                  <p className="text-sm text-muted-foreground">{r.paid_at ? `Paid ${day(r.paid_at)}` : r.status === "pending" ? `Available ${day(r.available_at)}` : r.failure ?? ""}</p>
                </div>
                <span className="font-medium">{money(r.amount_cents, { exact: true })}</span>
                <Badge variant={STATUS[r.status]?.tone ?? "outline"}>{STATUS[r.status]?.label ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
