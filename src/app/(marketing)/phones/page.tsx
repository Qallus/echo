import Link from "next/link";
import { ArrowRight, BadgeCheck, Cable, Clock, Phone, PhoneCall, Router, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { SectionHead } from "@/components/marketing/phones/sections";
import { SEGMENTS, priceLabel, publicHardware, type HardwareItem, type HardwareSegment } from "@/lib/redial/hardware";

export const metadata = {
  title: "Shop phones · Redial",
  description: "Phone adapters, cordless and desk phones that set themselves up on Redial: Grandstream and Yealink for home and business, and a Redial-first smartphone coming later.",
  alternates: { canonical: "/phones" },
};

function HardwareIcon({ h }: { h: HardwareItem }) {
  if (h.segment === "mobile") return <Smartphone className="size-5" />;
  if (/adapter/i.test(h.type)) return <Router className="size-5" />;
  return /desk/i.test(h.type) ? <PhoneCall className="size-5" /> : <Phone className="size-5" />;
}

function Card({ h }: { h: HardwareItem }) {
  const soon = h.status === "coming_soon";
  return (
    <article className="flex flex-col rounded-2xl border bg-background p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted"><HardwareIcon h={h} /></span>
        {soon ? <Badge variant="outline"><Clock /> Coming later</Badge> : h.autoSetup ? <Badge variant="outline"><BadgeCheck /> Sets itself up</Badge> : null}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{h.brand}</p>
      <h3 className="text-lg font-semibold">{h.model}</h3>
      <p className="text-sm text-muted-foreground">{h.type}</p>
      <p className="mt-3 flex-1 text-sm">{h.blurb}</p>
      {h.openSource && <p className="mt-2 text-xs text-muted-foreground">Open source: {h.openSource}</p>}
      <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
        <span className="font-semibold">{priceLabel(h)}</span>
        <Button size="sm" variant={soon ? "outline" : "default"} nativeButton={false}
          render={<Link href={`/contact?type=${h.segment === "business" ? "business" : "residential"}&device=${h.id}#form`} />}>
          {soon ? "Tell me when" : "Request this phone"}
        </Button>
      </div>
    </article>
  );
}

function Segment({ id, alt }: { id: HardwareSegment; alt?: boolean }) {
  const s = SEGMENTS[id];
  return (
    <section id={id} className={alt ? "scroll-mt-20 border-t bg-muted/30" : "scroll-mt-20 border-t"}>
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow={s.label} title={s.title} sub={s.sub} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicHardware(id).map((h) => <Card key={h.id} h={h} />)}
        </div>
      </div>
    </section>
  );
}

// Shop phones: the hardware Redial recommends for home and business lines,
// and the Redial-first smartphone that's coming. Requests go to the contact
// form (with the phone filled in) until online ordering is set up.
export default function PhonesPage() {
  return (
    <>
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-medium text-muted-foreground">Shop phones</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Phones that set themselves up on Redial.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Pick a phone, and we ship it ready for your Redial line. Plug it in and it registers on its own: no settings to type, no IT person needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {(Object.keys(SEGMENTS) as HardwareSegment[]).map((k) => (
              <Button key={k} variant="outline" nativeButton={false} render={<a href={`#${k}`} />}>{SEGMENTS[k].label}</Button>
            ))}
            <Button variant="ghost" nativeButton={false} render={<a href="#own" />}>Use your own phone <ArrowRight /></Button>
          </div>
        </div>
      </section>

      <Segment id="home" alt />
      <Segment id="business" />
      <Segment id="mobile" alt />

      <section id="own" className="scroll-mt-20 border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <SectionHead eyebrow="Already have phones?" title="Bring your own." sub="Most Grandstream, Yealink and Poly phones, and other standard SIP phones, work with Redial. Adapters keep the corded phones you already own." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/business-phone#phones" />}><Cable /> Phones that work</Button>
            <Button nativeButton={false} render={<Link href="/pricing#phone-service" />}>Phone plans <ArrowRight /></Button>
          </div>
        </div>
        <p className="mx-auto w-full max-w-6xl px-4 pb-12 text-xs text-muted-foreground sm:px-6">
          Prices are typical store prices; we confirm yours, with shipping, before anything is charged. Brand names belong to their owners. Redial isn&apos;t affiliated with these manufacturers.
        </p>
      </section>

      <FinalCta />
    </>
  );
}
