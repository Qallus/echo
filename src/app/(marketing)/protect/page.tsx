import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Ban, Bell, ChevronDown, CircleCheck, CircleHelp, FileText, Gift, Headset, HeartHandshake, KeyRound, Landmark, Laptop,
  PhoneCall, PhoneForwarded, Scale, ShieldCheck, ShieldX, Smile, Truck, UserRound, Voicemail, Waves,
} from "lucide-react";
import { FaqSection } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { FaqJsonLd, SectionHead } from "@/components/marketing/phones/sections";
import { ExampleCalls } from "@/components/marketing/protect/example-calls";
import { FeaturesTable, StatusBadge } from "@/components/marketing/protect/features-table";
import { PlayByPlay } from "@/components/marketing/protect/play-by-play";
import { Button } from "@/components/ui/button";
import { FAQ_TOPICS } from "@/lib/faq";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Fraud protection · Redial answers first, so scammers never reach your parents",
  description: "Redial screens unknown calls, asks for your family code word, calls the real grandchild to check they're safe, flags scam stories like bail, gift cards and couriers, and texts family when it stops a likely scam. Included in every Redial plan.",
  alternates: { canonical: "/protect" },
};

// Figures re-checked Nov 2026 against the FBI IC3 2025 Internet Crime Report
// (released Apr 2026) and the FTC's Protecting Older Consumers 2025-2026
// report to Congress (Oct 2026). Refresh when the 2026 reports come out.
const STATS = [
  { value: "$7.7B", label: "lost by Americans 60+ in 2025, more than any other age group" },
  { value: "+59%", label: "rise in those losses in one year (from $4.9B in 2024)" },
  { value: "201,266", label: "complaints filed with the FBI by people 60+" },
  { value: "$893M", label: "lost to AI-related scams, the first year the FBI tracked them" },
];
const SOURCES = [
  { label: "FBI IC3, 2025 Internet Crime Report", href: "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf" },
  { label: "FTC, Protecting Older Consumers 2025-2026", href: "https://www.ftc.gov/reports" },
];

const VERDICTS = [
  { icon: CircleCheck, label: "Looks legit", desc: "Rings through, or takes a message, like any good call.", tone: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" },
  { icon: CircleHelp, label: "Can't verify", desc: "Takes a message with a written summary. You decide whether to call back on a number you trust.", tone: "text-amber-700 dark:text-amber-400 bg-amber-500/10" },
  { icon: ShieldX, label: "Likely scam", desc: "Stopped before the phone rings, blocked, and family is told.", tone: "text-red-700 dark:text-red-400 bg-red-500/10" },
];

const FAMILY = [
  { icon: Smile, title: "Nothing new to learn", desc: "Works on the home phone or cell they already use. Family and saved contacts ring straight through." },
  { icon: Bell, title: "You stay in the loop", desc: "Get a text when Redial stops a likely scam. With the line shared with you, listen in or take over a live call." },
  { icon: FileText, title: "A weekly summary", desc: "See what rang through, went to voicemail, or was stopped." },
  { icon: HeartHandshake, title: "Independence, kept", desc: "They stay in charge of their phone. You see alerts and summaries, not every call." },
];

const SCAMS = [
  { icon: UserRound, title: "Grandchild needs bail", desc: "A \"grandchild\" in jail or a crash who needs money now and begs you not to tell anyone." },
  { icon: Scale, title: "Fake lawyer or courier", desc: "A follow-up call from a \"public defender\", then a stranger at the door to collect cash." },
  { icon: Waves, title: "AI voice clones", desc: "A voice that sounds exactly like someone you love, sometimes with a ransom demand." },
  { icon: Landmark, title: "Government impostors", desc: "Fake IRS, Social Security or Medicare calls threatening arrest or cut-off benefits." },
  { icon: BadgeCheck, title: "Bank \"fraud team\"", desc: "Asks you to read back a code or move money to a \"safe\" account." },
  { icon: Laptop, title: "Tech support", desc: "A virus on your computer and a fee to fix it." },
  { icon: Gift, title: "Prizes and sweepstakes", desc: "You've won, but there's a fee to collect." },
  { icon: Truck, title: "Couriers at the door", desc: "Anyone sent to the house to pick up cash, cards or gold." },
];

const FAQ = FAQ_TOPICS.find((t) => t.id === "protect")?.items ?? [];

export default function ProtectPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 overflow-x-clip px-4 pt-16 pb-16 sm:px-6 sm:pt-24 lg:grid-cols-[1fr_22rem]">
        <div>
        <p className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-3.5" /> Fraud protection, in every Redial plan</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Scammers are calling everyone. Redial calls them out.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          &ldquo;Grandma, I&apos;m in jail and need bail money.&rdquo; Today that voice can be cloned by AI. Redial screens unknown calls, checks the story, and stops likely scams before your mom or dad hears them.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>Protect your phone <ArrowRight /></Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#play-by-play" />}>See how it works</Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Works with the phone they already have. Same number. Scammers talk to Redial; you talk to the people who matter.</p>
        </div>
        <FamilyAlert />
      </section>

      {/* Why now */}
      <section className="border-t bg-neutral-950 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-sm font-medium text-white/60">Why this matters right now</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Older Americans are targeted harder than ever.</h2>
          <dl className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.value} className="border-l border-white/15 pl-4">
                <dt className="text-3xl font-semibold tabular-nums sm:text-4xl">{s.value}</dt>
                <dd className="mt-1 text-sm text-white/70">{s.label}</dd>
              </div>
            ))}
          </dl>
          <ReadMore className="mt-8 text-white/80" dark title="Why older adults are targeted">
            <p>Americans 60 and older reported $7.7 billion in losses to the FBI in 2025, more than any other age group and about 59% more than the year before. They filed 201,266 complaints.</p>
            <p>Scammers go after older adults because they&apos;re home, they answer the phone, they&apos;re polite, and they&apos;ve spent a lifetime saving. And the reported numbers are only the start: many victims never come forward. The FTC estimates the real cost of fraud to older adults in 2025 was somewhere between $13.3 billion and $119.5 billion.</p>
            <p>AI is making it worse. 2025 was the first year the FBI tracked AI-related fraud on its own: $893 million in reported losses.</p>
          </ReadMore>
          <p className="mt-6 text-xs text-white/50">
            Sources: {SOURCES.map((s, i) => <span key={s.href}>{i > 0 && "; "}<a href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">{s.label}</a></span>)}.
          </p>
        </div>
      </section>

      {/* Play by play */}
      <section id="play-by-play" className="scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="The play by play" title="How Redial stops a grandparent scam in under a minute." />
          <div className="mt-10"><PlayByPlay /></div>
        </div>
      </section>

      {/* Example calls */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Example calls" title="Scammers rely on fear. Redial relies on facts." />
          <ExampleCalls />
        </div>
      </section>

      {/* AI vs AI */}
      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Fighting AI with AI" title="Scammers have AI now. So does your mom's phone."
            sub="A few seconds of video is enough to clone a voice. Redial doesn't trust how a caller sounds. It checks what they know, where they're calling from and what they want." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: KeyRound, title: "Code word", desc: "A clone can copy a voice, not a secret. Redial checks the word; the AI never knows it.", soon: false },
              { icon: PhoneForwarded, title: "Call-back check", desc: "Redial calls the real person on their saved number to confirm they're safe.", soon: false },
              { icon: Waves, title: "Voice signals", desc: "Listening for signs a voice was generated by AI.", soon: true },
            ].map(({ icon: Icon, title, desc, soon }) => (
              <div key={title} className="rounded-2xl border p-6">
                <div className="flex items-center justify-between"><Icon className="size-5" />{soon && <StatusBadge status="Coming soon" />}</div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <ReadMore className="mt-6" title="How Redial fights AI scams">
            <p>A birthday video, a voicemail greeting or a social media clip is enough for cheap AI tools to copy a voice, and some can talk back in it live. &ldquo;Does it sound like him?&rdquo; is no longer a safe test.</p>
            <p>The script still gives it away: a perfect voice still asks for bail in gift cards, a courier at the door and secrecy. Redial flags the request, not just the voice. It also checks the caller ID with the phone network, because scammers fake numbers to look like a bank, the police or a family member.</p>
          </ReadMore>
        </div>
      </section>

      {/* Security features */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Security features" title="Every layer of protection, in one place." />
          <FeaturesTable />
          <p className="mt-4 text-sm text-muted-foreground">No screening catches every scam. Redial helps verify callers and flags the ones that look suspicious. The safest habit is still to hang up and call back on a number you trust.</p>
        </div>
      </section>

      {/* Verdicts */}
      <section id="how" className="scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="How it decides" title="Three answers, every time." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {VERDICTS.map(({ icon: Icon, label, desc, tone }) => (
              <div key={label} className="rounded-2xl border p-6">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", tone)}><Icon className="size-4" /> {label}</span>
                <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For families */}
      <section id="families" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="For parents and grandparents" title="Protection they don't have to think about."
            sub="Redial stands between your parent and the caller, so a kind person never has to become a suspicious one." />
          {/* The summary card stretches to the height of the two card rows, so tops and bottoms line up. */}
          <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="grid gap-4 sm:grid-cols-2">
              {FAMILY.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border bg-background p-5">
                  <Icon className="size-5" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4 rounded-2xl bg-neutral-950 p-6 text-white shadow-lg ring-1 ring-white/10 dark:bg-neutral-800 dark:ring-white/20">
              <div>
                <p className="text-sm font-semibold">Mom&apos;s week</p>
                <p className="text-xs text-white/60">Weekly summary · example</p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[{ n: 14, l: "Rang through", i: PhoneCall }, { n: 6, l: "Voicemail", i: Voicemail }, { n: 2, l: "Scams stopped", i: Ban }].map(({ n, l, i: Icon }) => (
                  <div key={l} className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                    <Icon className="mx-auto size-4 text-white/60" />
                    <dt className="mt-1 text-2xl font-semibold tabular-nums">{n}</dt>
                    <dd className="text-[11px] text-white/60">{l}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-auto rounded-xl bg-white/[0.07] p-3 text-xs leading-relaxed text-white/80 ring-1 ring-white/10"><span className="font-medium text-white">Thu 2:14 pm:</span> someone posing as Tyler asked for bail in gift cards. Tyler was safe. Number blocked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Scams */}
      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="What Redial listens for" title="The scams Redial watches for." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCAMS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border p-5">
                <Icon className="size-5" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <SectionHead eyebrow="If something goes wrong" title="Every call, ready to report."
              sub="Echo keeps the transcript and summary of every screened call: the number, the time and the exact words. You have what your bank or the police will ask for." />
            <p className="mt-4 text-sm text-muted-foreground">There&apos;s no shame in reporting. These are professional criminals, and they fool smart people every day.</p>
          </div>
          <div className="rounded-2xl border bg-background p-6">
            <h3 className="flex items-center gap-2 font-semibold"><Headset className="size-4" /> Where to report</h3>
            <ol className="mt-4 space-y-3 text-sm">
              <li><span className="font-medium">Your bank, right away,</span> <span className="text-muted-foreground">if money moved.</span></li>
              <li><span className="font-medium">Local police.</span></li>
              <li><span className="font-medium">The FBI</span> <span className="text-muted-foreground">at</span> <a className="underline underline-offset-2" href="https://www.ic3.gov" target="_blank" rel="noopener noreferrer">ic3.gov</a></li>
              <li><span className="font-medium">The FTC</span> <span className="text-muted-foreground">at</span> <a className="underline underline-offset-2" href="https://reportfraud.ftc.gov" target="_blank" rel="noopener noreferrer">reportfraud.ftc.gov</a></li>
            </ol>
          </div>
        </div>
      </section>

      <FaqSection items={FAQ} title="Fraud protection questions" className="border-t" />
      <FinalCta title="Let Redial take the calls they shouldn't have to." sub="Set it up for someone you love in a few minutes. Fraud protection is included in every plan, including Free." />
    </>
  );
}

// The text a trusted contact gets when Redial stops a scam (hero visual).
function FamilyAlert() {
  return (
    <div aria-label="Example alert text to a family member" role="img" className="relative mx-auto w-full max-w-[22rem]">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(239,68,68,0.14),transparent)]" />
      <div className="rounded-[2rem] border bg-background p-5 shadow-xl">
        <p className="text-center text-xs text-muted-foreground">Karen&apos;s phone · 2:15 pm</p>
        <div className="mt-4 rounded-2xl border bg-muted/40 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground"><ShieldX className="size-3.5 text-red-600" /> REDIAL · now</p>
          <p className="mt-2 font-semibold">Redial stopped a scam call to Mom</p>
          <p className="mt-1 text-sm text-muted-foreground">Someone posing as Tyler asked for bail in gift cards. Tyler is safe. Number blocked.</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          {[{ i: KeyRound, t: "No code word" }, { i: PhoneForwarded, t: "Tyler is safe" }, { i: Ban, t: "Blocked" }].map(({ i: Icon, t }) => (
            <span key={t} className="rounded-xl border px-2 py-2"><Icon className="mx-auto mb-1 size-4" />{t}</span>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Mom&apos;s phone never rang.</p>
      </div>
    </div>
  );
}

// A "Read more" that opens in place (no modal).
function ReadMore({ title, children, className, dark }: { title: string; children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <details className={cn("group max-w-3xl", className)}>
      <summary className={cn("inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden", dark && "text-white")}>
        Read more: {title} <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className={cn("mt-3 space-y-3 text-sm leading-relaxed", dark ? "text-white/75" : "text-muted-foreground")}>{children}</div>
    </details>
  );
}
