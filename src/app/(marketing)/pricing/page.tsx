import { AppBadges } from "@/components/marketing/app-badges";
import { PlanSection, ProductGrid } from "@/components/store/store";
import { ALL_FAQ } from "@/lib/faq";
import Link from "next/link";

export const metadata = {
  title: "Pricing and plans · Echo",
  description: "Echo plans for individuals and teams, monthly or annual, plus Redial call screening, a phone line, minute packs and setup services.",
  alternates: { canonical: "/pricing" },
};

const FAQ = ALL_FAQ.filter((f) => f.pricing);

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Simple plans that grow with your team</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start free. Upgrade when you need more minutes, a shared workspace or to plug Echo into the rest of your stack.</p>
        <p className="mt-6 text-sm text-muted-foreground">One account on the web and on your phone</p>
        <AppBadges source="pricing" className="mt-3 justify-center" />
      </header>

      <section className="mt-12"><PlanSection /></section>

      <section className="mt-24 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bolt-ons</h2>
          <p className="mt-1 text-muted-foreground">Add to any paid plan. Billed monthly, cancel any time.</p>
        </div>
        <ProductGrid kind="bolt_on" />
      </section>

      <section id="packs" className="mt-20 scroll-mt-24 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Minute packs</h2>
          <p className="mt-1 text-muted-foreground">One-time top-ups for busy months.</p>
        </div>
        <ProductGrid kind="pack" />
      </section>

      <section className="mt-20 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Services</h2>
          <p className="mt-1 text-muted-foreground">Hands-on help from the Echo team.</p>
        </div>
        <ProductGrid kind="service" />
      </section>

      <section className="mx-auto mt-24 max-w-3xl">
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
