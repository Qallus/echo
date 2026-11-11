import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BUSINESS_FRAMES, HOME_FRAMES } from "@/components/marketing/phones/frames";
import { CordlessPhone, DeskPhone } from "@/components/marketing/phones/phone-art";

// Home page: Redial as a full phone line, at home and at work, with the drawn
// phones from the phone service pages.
const CARDS = [
  {
    href: "/home-phone", eyebrow: "Home phone", title: "Replace the landline. Keep the number.",
    desc: "Cordless and Wi-Fi phones around the house, spam that never rings, and your mobile ringing along.",
    art: <div className="[zoom:0.6]"><CordlessPhone frames={HOME_FRAMES} /></div>,
  },
  {
    href: "/business-phone", eyebrow: "Business phone", title: "A phone system with a receptionist built in.",
    desc: "Desk phones that set themselves up, extensions for the team, and every caller answered.",
    art: <div className="md:[zoom:0.62] lg:[zoom:0.68]"><DeskPhone frames={BUSINESS_FRAMES} /></div>,
  },
];

export function PhoneServiceSection() {
  return (
    <section id="phone-service" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">Phone service</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Redial can be your phone line, too.</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">Real desk and cordless phones on a Redial number, with the same assistant answering for you.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="group flex flex-col overflow-hidden rounded-3xl border bg-muted/30 transition-colors hover:bg-muted/50">
              <div className="flex h-[30rem] items-end justify-center overflow-hidden px-6 pt-8">{c.art}</div>
              <div className="border-t bg-background p-6">
                <p className="text-sm font-medium text-muted-foreground">{c.eyebrow}</p>
                <h3 className="mt-1 text-xl font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">Learn more <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
