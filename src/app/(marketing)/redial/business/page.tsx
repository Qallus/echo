import Link from "next/link";
import {
  ArrowRight, Bot, BookOpen, CalendarClock, Clock, FileText, Hammer, Home, PhoneForwarded, PhoneMissed, Scale, Scissors, ShieldAlert, Stethoscope,
  UsersRound, Wrench,
} from "lucide-react";
import { FaqSection } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { LiveControlsSection } from "@/components/marketing/home/live-controls";
import { PricingPreviewSection } from "@/components/marketing/home/pricing-preview";
import { Button } from "@/components/ui/button";
import { ALL_FAQ } from "@/lib/faq";

export const metadata = {
  title: "Redial for business · An assistant on the line for every customer",
  description: "Redial's AI assistant, DJ, answers your business calls, knows your services and hours, catches every lead after hours, transfers to the right teammate and summarizes every call for your team.",
  alternates: { canonical: "/redial/business" },
};

const PAINS = [
  { icon: PhoneMissed, title: "Missed calls are missed jobs", desc: "When you're on a roof, with a client or closed for the night, the next caller just tries someone else." },
  { icon: ShieldAlert, title: "Spam eats the day", desc: "Warranty pitches and robocalls interrupt the work that pays." },
  { icon: Clock, title: "Voicemail is where leads go cold", desc: "Few callers leave a message, and those who do wait hours for a reply." },
];
const HELPS = [
  { icon: BookOpen, title: "DJ knows your business", desc: "Your services, prices, service area, hours and common questions, so callers get real answers." },
  { icon: Bot, title: "Every caller qualified", desc: "DJ finds out who's calling, what they need and how urgent it is, and screens out spam." },
  { icon: PhoneForwarded, title: "The right teammate, right away", desc: "Transfer to sales, the crew or the office. They hear who's calling before they pick up." },
  { icon: CalendarClock, title: "Callbacks booked, not lost", desc: "When nobody can take it, DJ books a callback and reminds you." },
  { icon: FileText, title: "A summary of every call", desc: "Who, why, what was promised, and next steps, shared with your team and ready for your CRM." },
  { icon: UsersRound, title: "One line, the whole team", desc: "Share a line and choose what each person can do: read, listen, guide or take over." },
];
const INDUSTRIES = [
  { icon: Hammer, label: "Contractors and trades" }, { icon: Home, label: "Real estate" }, { icon: Stethoscope, label: "Clinics and practices" },
  { icon: Scissors, label: "Salons and studios" }, { icon: Scale, label: "Law offices" }, { icon: Wrench, label: "Home services" },
];
const FAQ = ALL_FAQ.filter((f) => [
  "How do calls reach Redial?", "Can I step into a call my assistant is handling?", "Can someone else help manage my calls?",
  "Does the assistant say it's an AI?", "How does Business pricing work?", "Who can see my calls?",
].includes(f.q));

export default function RedialBusinessPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium text-muted-foreground">Redial for business</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">An assistant on the line for every customer.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          DJ answers the calls you can&apos;t, knows your business, catches every lead after hours and puts the right calls through. You keep your number.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup?type=business" />}>Set up your business line <ArrowRight /></Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/pricing" />}>See pricing</Button>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-3">
          {PAINS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-muted/30 p-6">
              <Icon className="size-5" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">What DJ does for your business</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Never miss a lead. Never answer spam.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HELPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-background p-6">
                <Icon className="size-5" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LiveControlsSection />

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Built for businesses that live on the phone</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {INDUSTRIES.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><Icon className="size-4" />{label}</span>
            ))}
          </div>
        </div>
      </section>

      <PricingPreviewSection />
      <FaqSection items={FAQ} />
      <FinalCta title="Put DJ on your business line." sub="Set up takes about five minutes, and you keep your number." business />
    </>
  );
}
