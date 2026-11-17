import { AppBadges } from "@/components/marketing/app-badges";
import { PricingPlans, ProductGrid } from "@/components/store/store";
import { getBillingSettings } from "@/lib/billing/settings";
import { ALL_FAQ } from "@/lib/faq";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { NumberPicker } from "@/components/numbers/number-picker";
import { AgentName } from "@/components/marketing/agent-name";

export const metadata = {
  title: "Pricing · Redial and Echo",
  description: "Redial call screening plans for you and your business, from free, plus Echo plans for recordings and transcripts. Monthly or annual, with minute packs and setup services.",
  alternates: { canonical: "/pricing" },
};

const FAQ = ALL_FAQ.filter((f) => f.pricing);

// ?product=echo opens on the Echo plans.
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const [{ product }, settings] = await Promise.all([searchParams, createClient().then(getBillingSettings)]);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Let <AgentName /> take the calls. Pay for what you need.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start free with Redial. Upgrade for more screening minutes, business features and more lines. Echo plans cover recordings and transcripts.</p>
        <p className="mt-6 text-sm text-muted-foreground">One account on the web and on your phone</p>
        <AppBadges source="pricing" className="mt-3 justify-center" />
      </header>

      <section className="mt-12">
        <PricingPlans initial={product === "echo" ? "echo" : "redial"} redialFreeMinutes={settings.redialFreeMinutes} echoFreeMinutes={settings.freeMinutes} />
      </section>

      <section id="protect" className="mt-16 scroll-mt-24 rounded-3xl border bg-muted/30 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><ShieldCheck className="size-4" /> Included in every plan, including Free</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Fraud protection</h2>
            <p className="mt-1 text-muted-foreground">Redial helps verify callers and stops likely scams before the phone rings.</p>
          </div>
          <Link href="/protect" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">How it works <ArrowRight className="size-3.5" /></Link>
        </div>
        <ul className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {["Family code word", "Call-back check to the real relative", "Caller ID and spoof check", "Scam-story and payment red flags", "Likely scams stopped and blocked", "Trusted contact alerts and a weekly summary"].map((f) => (
            <li key={f} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{f}</li>
          ))}
        </ul>
      </section>

      <section id="numbers" className="mt-24 scroll-mt-24 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pick your number</h2>
          <p className="mt-1 text-muted-foreground">Search real local and toll-free numbers, or keep the one you have. <Link href="/numbers" className="font-medium text-foreground underline underline-offset-2">More ways to search</Link></p>
        </div>
        <NumberPicker compact />
      </section>

      <section id="bolt-ons" className="mt-24 scroll-mt-24 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bolt-ons</h2>
          <p className="mt-1 text-muted-foreground">Add to any paid plan. Billed monthly, cancel any time.</p>
        </div>
        <ProductGrid kind="bolt_on" />
      </section>

      <section id="packs" className="mt-20 scroll-mt-24 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Minute packs</h2>
          <p className="mt-1 text-muted-foreground">One-time top-ups for busy months: Redial screening minutes or Echo transcription minutes.</p>
        </div>
        <ProductGrid kind="pack" />
      </section>

      <section className="mt-20 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Services</h2>
          <p className="mt-1 text-muted-foreground">Hands-on help from our team.</p>
        </div>
        <ProductGrid kind="service" />
      </section>

      <section className="mt-24">
        <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
        <div className="mt-6 divide-y rounded-xl border">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-4">{f.q}<span className="text-muted-foreground transition-transform group-open:rotate-45">+</span></span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground"><Link href="/faq#topic-billing" className="font-medium text-foreground underline underline-offset-2">More billing questions</Link></p>
      </section>
    </div>
  );
}
