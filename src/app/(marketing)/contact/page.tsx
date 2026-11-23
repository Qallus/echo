import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarClock, CircleHelp, Mail, MapPin, Phone } from "lucide-react";
import { AgentIcon } from "@/components/marketing/agent-icon";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import { ContactForm } from "./contact-form";
import { CONTACT_TYPES, type ContactType } from "./types";
import { HARDWARE } from "@/lib/redial/hardware";

export const metadata = {
  title: "Contact · Redial",
  description: "Questions about Redial for your home or business, AI Agents or Live Agents. A real person replies within one business day.",
  alternates: { canonical: "/contact" },
};

const maps = encodeURIComponent(COMPANY.address);

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string; device?: string }> }) {
  const { type, device } = await searchParams;
  // From Shop phones: "Request this phone" fills in the message.
  const phone = HARDWARE.find((h) => h.id === device && h.status !== "staff_only");
  const prefill = phone ? `I'd like the ${phone.brand} ${phone.model} (${phone.type}) for Redial.
How many: 
Ship to (city, state): ` : undefined;
  const initial = CONTACT_TYPES.includes(type as ContactType) ? (type as ContactType) : "residential";

  return (
    <>
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Get in touch</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Let&apos;s start a conversation.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Whether it&apos;s your home phone, your business line, an AI agent or a team of Live Agents, tell us what you need. A real person replies within one business day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<a href="#form" />}>Send us a message <ArrowDown /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/book" />}><CalendarClock /> Book a call</Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Below, choose <span className="font-medium text-foreground">Residential</span>, <span className="font-medium text-foreground">Business</span>, <span className="font-medium text-foreground">AI Agents</span> or <span className="font-medium text-foreground">Live Agents</span>. The form changes to match.
          </p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl items-start gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <ContactForm initial={initial} prefill={prefill} />

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-2xl border p-5">
            <h2 className="text-lg font-semibold">Reach us</h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p>{COMPANY.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <a href={`https://www.google.com/maps/search/?api=1&query=${maps}`} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">Google Maps →</a>
                    <span className="mx-2">|</span>
                    <a href={`https://maps.apple.com/?q=${maps}`} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">Apple Maps →</a>
                  </p>
                </div>
              </li>
              <li className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Phone</p><a href={COMPANY.phoneHref} className="text-muted-foreground hover:underline">{COMPANY.phone}</a></div></li>
              <li className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Email</p><a href={`mailto:${COMPANY.email}`} className="text-muted-foreground hover:underline">{COMPANY.email}</a></div></li>
            </ul>
          </section>

          <section className="rounded-2xl border p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted"><AgentIcon className="size-5" /></span>
            <h2 className="mt-3 text-lg font-semibold">Want to be a Live Agent?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Answer calls for businesses from home. Set your own hours and rate, and get paid through Redial.</p>
            <Link href="/become-a-live-agent" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">Become a Live Agent <ArrowRight className="size-3.5" /></Link>
          </section>

          <section className="rounded-2xl border bg-muted/30 p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-background"><CircleHelp className="size-5" /></span>
            <h2 className="mt-3 text-lg font-semibold">Quick answer?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Setup, pricing, keeping your number, scam protection and more.</p>
            <Link href="/faq" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">Browse the FAQ <ArrowRight className="size-3.5" /></Link>
          </section>
        </aside>
      </div>
    </>
  );
}
