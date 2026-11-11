import Link from "next/link";
import { Siren, type LucideIcon } from "lucide-react";
import type { Faq } from "@/lib/faq";
import { PHONE_MODELS, VENDORS, type PhoneVendor } from "@/lib/redial/phone-models";
import { Named } from "@/components/marketing/agent-name";

// Sections the home phone and business phone pages share.

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"><Named text={title} /></h2>
      {sub && <p className="mt-3 max-w-2xl text-muted-foreground"><Named text={sub} /></p>}
    </>
  );
}

export function StepsSection({ id, eyebrow, title, steps }: { id?: string; eyebrow: string; title: string; steps: { title: string; desc: string }[] }) {
  return (
    <section id={id} className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow={eyebrow} title={title} />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border p-6">
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">{i + 1}</span>
              <h3 className="mt-4 font-semibold"><Named text={s.title} /></h3>
              <p className="mt-1 text-sm text-muted-foreground"><Named text={s.desc} /></p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FeatureGrid({ eyebrow, title, items, muted = true }: { eyebrow: string; title: string; items: { icon: LucideIcon; title: string; desc: string }[]; muted?: boolean }) {
  return (
    <section className={muted ? "border-t bg-muted/30" : "border-t"}>
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow={eyebrow} title={title} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title: t, desc }) => (
            <div key={t} className="rounded-2xl border bg-background p-6">
              <Icon className="size-5" />
              <h3 className="mt-4 font-semibold"><Named text={t} /></h3>
              <p className="mt-1 text-sm text-muted-foreground"><Named text={desc} /></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// The phones that work, grouped by maker, with where each takes Redial's
// setup address.
export function SupportedPhones({ title, sub }: { title: string; sub: string }) {
  const vendors = Object.keys(VENDORS) as PhoneVendor[];
  return (
    <section id="phones" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="Phones that work" title={title} sub={sub} />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {vendors.map((v) => (
            <div key={v} className="rounded-2xl border p-6">
              <h3 className="font-semibold">{VENDORS[v].label}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {PHONE_MODELS.filter((m) => m.vendor === v).map((m) => (
                  <li key={m.id}><span className="font-medium">{m.name}</span> <span className="text-muted-foreground">· {m.note}</span></li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">Setup: {VENDORS[v].setup}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Brand names belong to their owners. Redial isn&apos;t affiliated with these manufacturers. Not sure about your phone? <Link href="/contact" className="underline underline-offset-4">Ask us</Link>.</p>
      </div>
    </section>
  );
}

export function EmergencyNotice() {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
          <Siren className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-2 text-sm">
            <h2 className="text-base font-semibold">About 911</h2>
            <p>Phone service starts once you register the address where your phones are. 911 calls from your Redial number go out with that address, so update it whenever you move your phones.</p>
            <p className="text-muted-foreground">Internet phone service needs power and an internet connection. During an outage, 911 from your desk or Wi-Fi phones won&apos;t work unless your router and phones have backup power. Keep a mobile phone handy as a backup.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Search engines read the page's questions from this.
export function FaqJsonLd({ items }: { items: Faq[] }) {
  const data = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
