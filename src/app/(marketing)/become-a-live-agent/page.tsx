import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Banknote, CalendarRange, Headphones, Home, Laptop, Mic, Shield, Sparkles, Star, UserRound, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/marketing/faq-list";
import { InterestButton } from "@/components/live-agents/interest-dialog";
import { getUser } from "@/lib/data";
import { getFees, listSkills } from "@/lib/live-agents/data";
import { feeSplit, money } from "@/lib/live-agents/types";

export const metadata = {
  title: "Become a Redial Live Agent · Get paid to answer business calls from home",
  description: "Set your own rates and hours, answer calls for businesses from your browser or phone, and let Redial's AI handle the busywork. Weekly payouts.",
  alternates: { canonical: "/become-a-live-agent" },
};

const PERKS = [
  { icon: Banknote, title: "Set your own rates", desc: "Per minute, per hour or monthly. You see what you'll take home before you accept any offer." },
  { icon: CalendarRange, title: "Work your hours", desc: "Set a weekly schedule, flip on \"Available now\" when you have time, and pause your listing whenever you like." },
  { icon: Home, title: "Work from anywhere", desc: "Answer from your browser or the Redial app. Your personal number is never shared." },
  { icon: Sparkles, title: "AI does the busywork", desc: "The Redial AI answers first, screens spam and tells you who's calling and why. Mirror suggests answers while you talk." },
  { icon: Star, title: "Build a reputation", desc: "Reviews, badges and a Redial Certified mark help businesses find you and book again." },
  { icon: Shield, title: "Paid through Redial", desc: "Businesses pay Redial up front, and you're paid weekly by direct deposit through Stripe." },
];

const STEPS = [
  { icon: UserRound, title: "Create your profile", desc: "Your first name, a photo, your experience, skills and languages." },
  { icon: Mic, title: "Record your voice", desc: "Up to three 15–30 second clips so businesses can hear you: a greeting, a transfer, your choice." },
  { icon: CalendarRange, title: "Set rates and hours", desc: "Your per-minute, hourly and monthly rates, and your weekly availability." },
  { icon: BadgeCheck, title: "Verify and get approved", desc: "Confirm your ID, set up payouts, and the Redial team reviews your profile before it goes live." },
];

const NEEDS = [
  { icon: Headphones, label: "A headset with a microphone" },
  { icon: Wifi, label: "Reliable internet" },
  { icon: Laptop, label: "A computer or smartphone" },
  { icon: Home, label: "A quiet place to take calls" },
];

const FAQ = [
  { q: "Am I an employee of Redial?", a: "No. Live Agents are independent professionals who choose their own clients, rates and hours. Redial provides the platform, the calls, the AI tools and the payments." },
  { q: "How do I get paid?", a: "Businesses pay Redial, and Redial pays you weekly by direct deposit through Stripe, after a short hold so disputes can be settled. Stripe handles tax forms." },
  { q: "How much does Redial keep?", a: "Redial keeps a percentage of your rate to cover payments, call routing, recording and support. You see your take-home amount on every offer before you accept." },
  { q: "Do I need a business phone line?", a: "No. Calls reach you in your browser or the Redial app. Your personal number is never shared with businesses or callers." },
  { q: "What kinds of calls will I take?", a: "Whatever you list: answering and transferring, booking appointments, intake, dispatch, order taking, support, bilingual calls and more. Businesses share a script and FAQs for every engagement." },
  { q: "Can I work for more than one business?", a: "Yes. You choose how many businesses you'll cover at once, and you can pause your listing any time." },
];

export default async function BecomeALiveAgentPage() {
  const [skills, fees, user] = await Promise.all([listSkills(), getFees(), getUser()]);
  const ex = feeSplit(3000, fees);
  // Signed in: straight to the profile builder. Otherwise create an account first.
  const start = user ? "/agent-desk/setup" : `/signup?next=${encodeURIComponent("/agent-desk/setup")}`;

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium text-muted-foreground">Become a Redial Live Agent</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Great on the phone? Get paid for it, on your schedule.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Answer calls for businesses that need a real person. Redial&apos;s AI answers first and hands you the calls that matter, with the caller&apos;s details on your screen.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href={start} />}>Create your profile <ArrowRight /></Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/live-agents" />}>See Live Agent profiles</Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          About 15 minutes, free. Not ready yet? <InterestButton kind="agent" variant="ghost" size="sm" className="h-auto px-1 align-baseline underline underline-offset-2" skills={skills} source="/become-a-live-agent">Get updates instead</InterestButton>
        </p>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Why answer calls on Redial</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-background p-6"><Icon className="size-5" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Get listed in four steps</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="rounded-2xl border p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{i + 1}</span><Icon className="size-4" /></div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">What you need</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {NEEDS.map(({ icon: Icon, label }) => <li key={label} className="flex items-center gap-3 rounded-xl border bg-background p-4 text-sm"><Icon className="size-4 shrink-0" /> {label}</li>)}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">You&apos;ll also verify your ID, and you can add an optional background check for a badge on your profile.</p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">What you take home</h2>
            <div className="mt-6 rounded-2xl border bg-background p-6">
              <p className="text-sm text-muted-foreground">Example: you set {money(3000)}/hour</p>
              <p className="mt-2 text-4xl font-semibold">{money(ex.agent, { exact: true })}<span className="text-base font-normal text-muted-foreground"> / hour to you</span></p>
              <p className="mt-3 text-sm text-muted-foreground">
                Redial keeps {fees.agentFeePercent}% of your rate for payments, call routing, recording and support. Payouts go out weekly through Stripe.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FaqSection items={FAQ} title="Questions from future Live Agents" />

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] px-6 py-14 text-center text-white sm:px-12">
            <Headphones className="mx-auto size-8 text-white/80" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Your voice. Your hours. Your rates.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Build your profile in about 15 minutes. The Redial team reviews it, then businesses can book you.</p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" className="bg-white text-neutral-900 hover:bg-white/90" nativeButton={false} render={<Link href={start} />}>Create your profile <ArrowRight /></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
