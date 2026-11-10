import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, products, type Product } from "@/lib/billing/catalog";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { getBillingSettings } from "@/lib/billing/settings";
import { createClient } from "@/lib/supabase/server";
import { CompareTable, type Cell, type CompareRow } from "./compare-table";

// Phone service plans next to the screening-only Redial plans. Prices,
// minutes and phone counts come from the live catalog (Admin > Billing); what
// each plan does is listed here.

type Traits = { line: string; business: boolean; live: boolean; transfers: boolean; share: boolean; e911: boolean };
const TRAITS: Record<string, Traits> = {
  free: { line: "Forward the calls you miss", business: false, live: false, transfers: false, share: false, e911: false },
  redial_personal: { line: "Forward your cell, or a Redial number", business: false, live: true, transfers: true, share: true, e911: false },
  redial_home_phone: { line: "A full home phone line", business: false, live: true, transfers: true, share: true, e911: true },
  redial_business: { line: "Forward your business line, or a Redial number", business: true, live: true, transfers: true, share: true, e911: false },
  redial_team: { line: "5 lines, forwarded or Redial numbers", business: true, live: true, transfers: true, share: true, e911: false },
  redial_business_phone: { line: "A full business phone line", business: true, live: true, transfers: true, share: true, e911: true },
};

export async function PlanCompare({ ids, title, sub }: { ids: string[]; title: string; sub: string }) {
  await loadCatalog();
  const settings = await getBillingSettings(await createClient());
  const all = products();
  const plans = ids.map((id) => (id === "free" ? "free" : all.find((p) => p.id === id))).filter((p): p is Product | "free" => Boolean(p));
  const key = (p: Product | "free") => (p === "free" ? "free" : p.id);
  const t = (p: Product | "free") => TRAITS[key(p)] ?? TRAITS.redial_personal;
  const monthly = (p: Product) => p.prices.find((x) => x.interval === "month") ?? p.prices[0];
  const row = (feature: string, cell: (p: Product | "free") => Cell): CompareRow => ({ feature, cells: plans.map(cell) });

  const rows: CompareRow[] = [
    row("Price", (p) => (p === "free" ? "$0" : `${money(monthly(p).unitAmount ?? 0)}${p.perSeat ? " per line" : ""} a month`)),
    row("Your phone line", (p) => t(p).line),
    row("Unlimited US and Canada calling", (p) => p !== "free" && Boolean(p.phones)),
    row("Desk, cordless and Wi-Fi phones", (p) => (p !== "free" && p.phones ? `Up to ${p.phones}${p.perSeat ? " per line" : ""}` : false)),
    row("AI screening minutes a month", (p) => (p === "free" ? String(settings.redialFreeMinutes) : `${(p.minutes ?? 0).toLocaleString()}${p.perSeat ? " per line" : p.id === "redial_team" ? " shared" : ""}`)),
    row("DJ knows your business (services, hours, FAQs)", (p) => t(p).business),
    row("Listen in, guide DJ, take over", (p) => t(p).live),
    row("Transfers and extensions", (p) => t(p).transfers),
    row("Share the line with family or a team", (p) => t(p).share),
    row("911 from your Redial number", (p) => (t(p).e911 ? "With your registered address" : "Use your cell for 911")),
  ];
  const columns = plans.map((p) => (p === "free" ? "Redial Free" : p.name));

  return (
    <section id="plans" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Compare plans</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{sub}</p>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/pricing#phone-service" />}>Choose a plan <ArrowRight /></Button>
        </div>
        <div className="mt-10"><CompareTable caption={title} columns={columns} rows={rows} /></div>
        <p className="mt-4 text-sm text-muted-foreground">Monthly prices. Annual plans get two months free. Unlimited calling is for normal personal and business use.</p>
      </div>
    </section>
  );
}
