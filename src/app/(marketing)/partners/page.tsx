import Link from "next/link";
import { ArrowDown, ArrowRight, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import { PartnerForm } from "./partner-form";
import { GROUPS, GROUP_IDS, type Group } from "./programs";

export const metadata = {
  title: "Partners and careers · Redial",
  description: "Resell Redial, share it as an affiliate or influencer, answer calls as a Live Agent, join the team in support or sales, or put your sales organization on the Redial reseller program.",
  alternates: { canonical: "/partners" },
};

const NEXT = [
  { t: "We read every request", d: "A real person reviews it, usually within one business day." },
  { t: "A short call", d: "We learn about you, your audience or your team, and answer your questions." },
  { t: "Get set up", d: "Partner pricing, your link or materials, or next steps for the role." },
];

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ type?: string; program?: string }> }) {
  const { type, program } = await searchParams;
  const byProgram = GROUPS.find((g) => g.programs.some((p) => p.id === program));
  const group: Group["id"] = byProgram?.id ?? (GROUP_IDS.includes(type as Group["id"]) ? (type as Group["id"]) : "partners");

  return (
    <>
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Partners and careers</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Grow with Redial.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Resell Redial, share it with your audience, answer calls as a Live Agent, join the team, or put your whole sales organization behind it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<a href="#form" />}>Apply now <ArrowDown /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/partners?type=resellers#form" />}>Reseller program for sales teams</Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl items-start gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <PartnerForm key={group + (program ?? "")} initialGroup={group} initialProgram={program} />

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-2xl border p-5">
            <h2 className="text-lg font-semibold">What happens next</h2>
            <ol className="mt-4 space-y-4 text-sm">
              {NEXT.map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{i + 1}</span>
                  <div><p className="font-medium">{s.t}</p><p className="text-muted-foreground">{s.d}</p></div>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl border p-5">
            <h2 className="text-lg font-semibold">Questions first?</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><a href={COMPANY.phoneHref} className="hover:underline">{COMPANY.phone}</a></li>
              <li className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><a href={`mailto:${COMPANY.email}`} className="hover:underline">{COMPANY.email}</a></li>
            </ul>
          </section>
          <section className="rounded-2xl border bg-muted/30 p-5">
            <h2 className="text-lg font-semibold">Looking for help with your account?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Questions about your phone, plan or billing go through the contact page.</p>
            <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">Contact us <ArrowRight className="size-3.5" /></Link>
          </section>
        </aside>
      </div>
    </>
  );
}
