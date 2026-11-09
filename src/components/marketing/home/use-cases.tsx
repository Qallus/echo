import Link from "next/link";
import { Briefcase, CalendarClock, Check, Clock, Heart, PhoneForwarded, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const PERSONAL = [
  { icon: Heart, text: "Family and friends on your VIP list always ring straight through." },
  { icon: ShieldCheck, text: "Spam and sales calls never make your phone ring." },
  { icon: CalendarClock, text: "Callers who matter get a callback booked, not a voicemail." },
  { icon: Sparkles, text: "Every call ends with a short summary you can read in seconds." },
];
const BUSINESS = [
  { icon: Clock, text: "Never miss a lead after hours, on a job or in a meeting." },
  { icon: Briefcase, text: "DJ knows your services, hours and common questions." },
  { icon: PhoneForwarded, text: "Calls go to the right teammate, with a heads-up first." },
  { icon: UsersRound, text: "Every call is summarized and shared with your team." },
];

// Homepage: who Redial is for.
export function UseCasesSection() {
  return (
    <section id="use-cases" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">Who it&apos;s for</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">For your life, and for your business.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Column title="For you" sub="Your own cell, without the interruptions." items={PERSONAL} cta={{ href: "/signup", label: "Start free" }} />
          <Column title="For your business" sub="An assistant on the line for every customer." items={BUSINESS} cta={{ href: "/signup?type=business", label: "Set up your business line" }} dark />
        </div>
      </div>
    </section>
  );
}

function Column({ title, sub, items, cta, dark }: {
  title: string; sub: string; items: { icon: React.ComponentType<{ className?: string }>; text: string }[]; cta: { href: string; label: string }; dark?: boolean;
}) {
  return (
    <div className={dark ? "flex flex-col rounded-2xl bg-[radial-gradient(120%_90%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] p-7 text-white" : "flex flex-col rounded-2xl border bg-background p-7"}>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className={dark ? "mt-1 text-sm text-white/70" : "mt-1 text-sm text-muted-foreground"}>{sub}</p>
      <ul className="mt-6 space-y-3.5">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-sm">
            <span className={dark ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10" : "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"}><Icon className="size-4" /></span>
            <span className="pt-1.5">{text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center gap-3">
        <Button nativeButton={false} variant={dark ? "secondary" : "default"} render={<Link href={cta.href} />}>{cta.label}</Button>
        <span className={dark ? "flex items-center gap-1 text-xs text-white/60" : "flex items-center gap-1 text-xs text-muted-foreground"}><Check className="size-3.5" /> No new phone needed</span>
      </div>
    </div>
  );
}
