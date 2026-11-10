import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lineOf, money, products } from "@/lib/billing/catalog";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { getBillingSettings } from "@/lib/billing/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Homepage: Redial Free and the Redial plans from the catalog, monthly prices.
export async function PricingPreviewSection() {
  await loadCatalog();
  const settings = await getBillingSettings(await createClient());
  const plans = products().filter((p) => p.kind === "plan" && lineOf(p) === "redial" && !p.echoMinutes).slice(0, 3);
  const cards = [
    { id: "free", name: "Redial Free", price: "$0", per: "", tagline: "Try DJ on the calls you miss.", features: [`${settings.redialFreeMinutes} AI screening minutes a month`, "VIP and block lists", "A summary of every call"], featured: false },
    ...plans.map((p) => {
      const price = p.prices.find((x) => x.interval === "month") ?? p.prices[0];
      return { id: p.id, name: p.name, price: money(price.unitAmount ?? 0), per: p.perSeat ? "/line/mo" : "/mo", tagline: p.tagline, features: (p.features ?? []).slice(0, 3), featured: Boolean(p.perSeat) };
    }),
  ];
  return (
    <section id="plans" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Start free. Upgrade when DJ is busy.</h2>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/pricing" />}>See all plans <ArrowRight /></Button>
        </div>
        <div className={cn("mt-10 grid gap-4 sm:grid-cols-2", cards.length >= 4 && "lg:grid-cols-4")}>
          {cards.map((c) => (
            <div key={c.id} className={cn("flex flex-col rounded-2xl border p-6", c.featured && "border-foreground shadow-lg")}>
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-sm text-muted-foreground">{c.tagline}</p>
              <p className="mt-4 text-3xl font-semibold tabular-nums">{c.price}<span className="text-sm font-normal text-muted-foreground">{c.per}</span></p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{c.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />{f}</li>)}</ul>
              <Button className="mt-6" variant={c.featured ? "default" : "outline"} nativeButton={false} render={<Link href={c.id === "free" ? "/signup" : "/pricing"} />}>
                {c.id === "free" ? "Start free" : `Choose ${c.name.replace(/^Redial /, "")}`}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Monthly prices. Annual plans get two months free. Echo plans for meetings are on the <Link href="/pricing?product=echo" className="underline underline-offset-4">pricing page</Link>.</p>
      </div>
    </section>
  );
}
