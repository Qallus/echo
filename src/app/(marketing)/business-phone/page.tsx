import Link from "next/link";
import {
  ArrowRight, BookOpen, Building2, CalendarClock, Clock, FileText, Lock, Network, PhoneForwarded, Router, ShieldBan, UsersRound,
} from "lucide-react";
import { FaqSection } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { LiveControlsSection } from "@/components/marketing/home/live-controls";
import { CompareTable } from "@/components/marketing/phones/compare-table";
import { DeskPhone, type ScreenFrame } from "@/components/marketing/phones/phone-art";
import { PlanCompare } from "@/components/marketing/phones/plan-compare";
import { EmergencyNotice, FaqJsonLd, FeatureGrid, SectionHead, StepsSection, SupportedPhones } from "@/components/marketing/phones/sections";
import { Button } from "@/components/ui/button";
import { ALL_FAQ, FAQ_TOPICS } from "@/lib/faq";
import { AgentName } from "@/components/marketing/agent-name";

export const metadata = {
  title: "Redial Business Phone · A phone system with an AI receptionist",
  description: "A business phone system on desk and Wi-Fi phones from Grandstream, Yealink and Poly that set themselves up. An AI assistant you name answers as your receptionist, transfers to the right extension, catches leads after hours and summarizes every call.",
  alternates: { canonical: "/business-phone" },
};

const FRAMES: ScreenFrame[] = [
  { tag: "Incoming · Main line", title: "(480) 555-0187", detail: "New caller", tone: "call" },
  { tag: "{agent} is answering", title: "Dana Ortiz · Summit Roofing", detail: "“Looking for a quote on a roof repair.”", tone: "dj" },
  { tag: "Transfer from {agent}", title: "Dana Ortiz → Sales (101)", detail: "Wants a roof repair quote this week. Press 1 to take it.", action: "Press 1", tone: "dj" },
  { tag: "After hours", title: "Callback booked", detail: "Dana Ortiz, 8:30 AM tomorrow. Summary sent to the team.", tone: "dj" },
];

const STEPS = [
  { title: "Choose your numbers", desc: "Bring your main business number, or pick new local numbers for each line." },
  { title: "Plug in your phones", desc: "Connect desk phones to the office network, or set Wi-Fi phones on their stands." },
  { title: "They set themselves up", desc: "Each phone gets its settings from Redial: your number, extension and line keys." },
  { title: "{agent} runs the front desk", desc: "{agent} greets callers, answers questions about your business and transfers to the right person." },
];

const FEATURES = [
  { icon: BookOpen, title: "A receptionist that knows you", desc: "Your services, prices, hours and service area, so callers get real answers on the first ring." },
  { icon: PhoneForwarded, title: "Extensions and transfers", desc: "Sales, the office or the crew, by extension. They hear who's calling before they pick up." },
  { icon: Clock, title: "After hours, handled", desc: "{agent} takes the late calls, qualifies the lead and books a callback for the morning." },
  { icon: ShieldBan, title: "No more spam at the desk", desc: "Robocalls and cold pitches are screened out before a single desk phone rings." },
  { icon: FileText, title: "Every call summarized", desc: "Who called, what they need and what was promised, ready for your CRM." },
  { icon: UsersRound, title: "Desk phones and mobiles together", desc: "A call rings the desk phone and the Redial app at once, so nobody is tied to a desk." },
];

const COMPARE = [
  { feature: "AI receptionist answers and qualifies callers", cells: [true, false, "Menu (press 1 for…)"] },
  { feature: "Desk, cordless and Wi-Fi phones", cells: [true, true, true] },
  { feature: "Phones set themselves up", cells: [true, "Technician visit", "Often"] },
  { feature: "Extensions and transfers", cells: [true, "With extra equipment", true] },
  { feature: "Desk phones and mobiles ring together", cells: [true, false, true] },
  { feature: "Listen in, guide or take over the assistant's call", cells: [true, false, false] },
  { feature: "Written summary of every call", cells: [true, false, "Add-on on some plans"] },
  { feature: "Spam and robocalls screened before they ring", cells: [true, false, "Basic spam filter"] },
  { feature: "Keep your business number", cells: [true, true, true] },
  { feature: "Long-term contract", cells: ["No, month to month", "Often", "Often yearly"] },
];

const SIP_POINTS = [
  { icon: Network, title: "Standard phones, no lock-in", desc: "Redial works with standard SIP phones, so you choose the brand and keep the phones if you ever leave." },
  { icon: Router, title: "Nothing to install in the closet", desc: "No phone system box, no wiring closet. Phones connect over the internet you already have." },
  { icon: Lock, title: "Private by design", desc: "Each phone has its own sign-in, and calls are encrypted where the phone supports it." },
];

const FAQ = [
  ...(FAQ_TOPICS.find((t) => t.id === "phones")?.items ?? []).filter((f) => !/alarm/i.test(f.q)),
  ...ALL_FAQ.filter((f) => ["Can I step into a call my assistant is handling?", "Does the assistant say it's an AI?", "Who can see my calls?"].includes(f.q)),
];

export default function BusinessPhonePage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-muted-foreground">Redial Business Phone</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">A business phone system with <AgentName /> at the front desk.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Real desk and Wi-Fi phones that set themselves up, extensions for your team, and an assistant that answers every call, knows your business and puts the right ones through.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/pricing#phone-service" />}>Get Redial Business Phone <ArrowRight /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/contact" />}>Talk to us</Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Per line pricing. Unlimited US and Canada calling. No contract.</p>
        </div>
        <DeskPhone frames={FRAMES} className="mt-16 max-w-2xl" />
      </section>

      <StepsSection id="how" eyebrow="How it works" title="A phone system without the phone closet." steps={STEPS} />

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="SIP, in plain words" title="Any standard internet phone. Your settings, delivered." sub="SIP is the standard internet phones use to connect to a phone service. Add a phone in Redial by its model and MAC address (it's on the sticker), and the phone downloads its own settings the first time it starts up." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {SIP_POINTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-background p-6">
                <Icon className="size-5" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SupportedPhones title="Desk phones and Wi-Fi phones from the brands you know." sub="Grandstream, Yealink and Poly phones are set up automatically. Most other SIP phones work with the settings Redial shows you." />

      <FeatureGrid eyebrow="Built for business" title="Every call answered. Every lead caught." items={FEATURES} />

      <LiveControlsSection />

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Compare" title="Redial Business Phone vs. the usual options." sub="Compared with a traditional business line from the phone company and a typical hosted phone system." />
          <div className="mt-10">
            <CompareTable caption="Redial Business Phone compared with a traditional business line and a typical hosted phone system" columns={["Redial Business Phone", "Traditional business line", "Typical hosted phone system"]} rows={COMPARE} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Features vary by provider and plan. Check your current provider for the details of your service.</p>
        </div>
      </section>

      <PlanCompare ids={["redial_business_phone", "redial_business", "redial_team"]} title="A full phone system, or {agent} on the number you have." sub="Business Phone replaces your phone system with desk phones and extensions. Business and Team put {agent} on your existing business number." />

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { icon: Building2, title: "Keeping your phone system?", desc: "Redial for business screens the calls your current system forwards.", href: "/redial/business" },
            { icon: CalendarClock, title: "Phone service at home too", desc: "Redial Home Phone puts the same assistant on the house phone.", href: "/home-phone" },
            { icon: FileText, title: "Meetings, recorded", desc: "Echo turns calls and meetings into transcripts and reports.", href: "/#features" },
          ].map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href} className="rounded-2xl border p-6 transition-colors hover:bg-muted/40">
              <Icon className="size-5" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <EmergencyNotice />
      <FaqSection items={FAQ} title="Business phone questions" />
      <FinalCta title="Give every caller a front desk." sub="Desk phones that set themselves up, and {agent} answering every call." business />
    </>
  );
}
