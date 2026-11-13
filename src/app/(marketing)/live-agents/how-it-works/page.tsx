import Link from "next/link";
import {
  ArrowRight, AudioLines, Bot, CalendarClock, CalendarDays, CircleDollarSign, Clock3, Ear, Gavel, Headset, Languages, MessageSquareText, Moon,
  PhoneForwarded, Rocket, Search, ShieldCheck, Sparkles, Sun, UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/marketing/faq-list";
import { InterestButton } from "@/components/live-agents/interest-dialog";
import { getFees, listSkills } from "@/lib/live-agents/data";
import { feeSplit, money } from "@/lib/live-agents/types";

export const metadata = {
  title: "How Redial Live Agents work · AI answers first, a person when it matters",
  description: "Your Redial AI answers every call. When a caller needs a person, it hands them to a Live Agent you picked, with the details already captured. Book on demand, by the shift or monthly.",
  alternates: { canonical: "/live-agents/how-it-works" },
};

const STEPS = [
  { icon: Bot, title: "Your Redial AI answers every call", desc: "It greets callers by your business name, answers common questions, screens spam, and books or takes messages on its own." },
  { icon: Search, title: "Pick your Live Agents", desc: "Browse real, vetted people. Hear their voice samples and compare skills, languages, experience, availability and rates." },
  { icon: CalendarDays, title: "Book the coverage you need", desc: "Per minute when calls need a person, scheduled shifts for lunch or launch day, or a monthly block of hours." },
  { icon: PhoneForwarded, title: "The AI hands off, with context", desc: "When a caller asks for a person or the AI hits its limits, it transfers to your Live Agent, who sees who's calling and why before saying hello." },
  { icon: CircleDollarSign, title: "Pay through Redial", desc: "One bill for every agent. Disputes are covered for 72 hours, and every call is recorded and summarized by Echo." },
];

const DOES = [
  { icon: Headset, title: "Answer", desc: "Greet callers in your business's name using your script and FAQs." },
  { icon: PhoneForwarded, title: "Transfer", desc: "Warm-transfer to anyone in your Redial directory: a teammate, a desk phone or a department." },
  { icon: CalendarClock, title: "Schedule", desc: "Book, confirm and reschedule appointments on your calendar." },
  { icon: MessageSquareText, title: "Follow up", desc: "Take detailed messages and send follow-up texts or emails from Redial." },
  { icon: Sparkles, title: "Get AI help live", desc: "Mirror suggests answers from your business info while they talk." },
  { icon: Bot, title: "Hand back to the AI", desc: "Return the caller to your Redial AI to finish booking or take a message." },
];

const USES = [
  { icon: Clock3, title: "Overflow", desc: "When every line is busy, the next caller still reaches a person." },
  { icon: Moon, title: "After hours", desc: "Evenings, overnights and weekends, with emergencies sorted from what can wait." },
  { icon: Sun, title: "Lunch and breaks", desc: "Keep the front desk covered while your team steps away." },
  { icon: Languages, title: "Bilingual lines", desc: "Spanish, Mandarin, French and more, without hiring for every language." },
  { icon: Rocket, title: "Launch days and events", desc: "Book extra hands by the shift when you expect a rush." },
  { icon: UserRoundCheck, title: "A virtual receptionist", desc: "The same familiar voice every week on a monthly plan." },
];

const FAQ = [
  { q: "Does the AI still answer first?", a: "Yes. Your Redial AI answers every call, handles what it can, and transfers to your Live Agent when a caller needs a person or asks for one. You choose the rules: always offer a person, only for certain questions, or only after hours." },
  { q: "What happens if the Live Agent doesn't pick up?", a: "If they don't answer within about 20 seconds, your Redial AI takes the call back and takes a message. You're not billed for transfers that weren't answered." },
  { q: "How is a Live Agent billed?", a: "On-demand is billed per connected minute, weekly. Shifts are authorized when you book and charged after the shift. Monthly plans include a block of hours, then per-minute. Redial adds a service fee to the agent's rate, shown before you book." },
  { q: "Can I listen to calls or take over?", a: "Yes. With Redial's live controls you can listen silently, send the agent private notes during the call, or take over the call yourself. Every call is recorded and summarized by Echo for both of you." },
  { q: "Will the Live Agent see my customers' phone numbers?", a: "Calls reach the agent through Redial, never their personal phone, and messages between you and the agent stay on Redial. Agents can't download recordings." },
  { q: "How are Live Agents vetted?", a: "Every profile is reviewed by the Redial team before it goes live, voice samples and photos are moderated, and identity is verified. Background-checked agents show a badge." },
  { q: "Can I choose agents by accent, age or gender?", a: "No. You can filter by skills, languages, industries, availability, experience and rate. Voice samples let you hear tone and clarity; they aren't for screening personal traits." },
];

export default async function HowItWorksPage() {
  const [skills, fees] = await Promise.all([listSkills(), getFees()]);
  const ex = feeSplit(3000, fees);

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium text-muted-foreground">Redial Live Agents · How it works</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">AI answers first. A real person when it matters.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          A call center you build yourself, one Live Agent at a time. Your Redial AI handles the routine calls; vetted people take the calls that need a human touch.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/live-agents" />}>Browse Live Agents <ArrowRight /></Button>
          <InterestButton kind="business" size="lg" variant="outline" skills={skills} source="/live-agents/how-it-works">Request coverage</InterestButton>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <ol className="grid gap-4 md:grid-cols-5">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="rounded-2xl border bg-muted/30 p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{i + 1}</span><Icon className="size-4" /></div>
                <h2 className="mt-4 font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">The handoff</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Your Live Agent knows why they&apos;re calling before they say hello.</h2>
            <p className="mt-4 text-muted-foreground">The Redial AI captures the caller&apos;s name, reason and details, then transfers to your Live Agent&apos;s Agent Desk. They see a call card with your script, FAQs and directory, and Mirror suggests answers as they talk.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[{ icon: Ear, t: "Listen in", d: "Hear the call silently" }, { icon: MessageSquareText, t: "Coach", d: "Send private notes" }, { icon: Gavel, t: "Take over", d: "Step into the call" }].map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-xl border bg-background p-3"><Icon className="size-4" /><p className="mt-2 text-sm font-medium">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div>
              ))}
            </div>
          </div>
          {/* An illustration of the Agent Desk call card. */}
          <div className="rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] p-5 text-white shadow-xl sm:p-7" aria-hidden>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className="inline-flex items-center gap-1.5"><AudioLines className="size-4 text-white/80" /> REDIAL · Agent Desk</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 animate-pulse rounded-full bg-emerald-400" /> Incoming transfer</span>
            </div>
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-xs tracking-wide text-white/60 uppercase">Sonoran Smiles Dental</p>
              <p className="mt-1 text-lg font-semibold">Elena Ruiz · existing patient</p>
              <p className="mt-1 text-sm text-white/70">Wants to move Thursday&apos;s cleaning to a morning next week.</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {["Prefers Spanish", "Mornings only", "Insurance on file"].map((t) => <span key={t} className="rounded-full bg-white/10 px-2 py-0.5">{t}</span>)}
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 p-4">
              <p className="inline-flex items-center gap-1.5 text-xs text-white/60"><Sparkles className="size-3.5" /> Mirror suggests</p>
              <p className="mt-1 text-sm">&ldquo;Dr. Patel has Tuesday at 8:30 or Wednesday at 9:00 open.&rdquo;</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <span className="rounded-xl bg-white/10 py-2.5 text-center">Let AI handle</span>
              <span className="rounded-xl bg-emerald-500 py-2.5 text-center font-medium text-neutral-950">Answer</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">On every call</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">What a Live Agent can do for your callers</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border p-6"><Icon className="size-5" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">When businesses book a Live Agent</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Coverage for the moments your team can&apos;t answer</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-background p-6"><Icon className="size-5" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{desc}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">Pricing</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Each Live Agent sets their rate. You see the total before you book.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { t: "On-demand", p: "Per connected minute", d: "A person only when a call needs one. 1-minute minimum per call, billed weekly. Unanswered transfers are free." },
              { t: "Shifts", p: "Per hour", d: "Book a block of time: lunch, a launch day, Saturday mornings. Authorized when you book, charged after the shift." },
              { t: "Monthly", p: "A block of hours", d: "A regular virtual receptionist. Hours included each month, then per minute. Cancel any month." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border p-6"><p className="text-sm text-muted-foreground">{c.p}</p><h3 className="mt-1 text-xl font-semibold">{c.t}</h3><p className="mt-2 text-sm text-muted-foreground">{c.d}</p></div>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-muted/30 p-5 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <p className="text-muted-foreground">
              Redial adds a {fees.businessFeePercent}% service fee to the agent&apos;s rate. For example, a {money(3000)}/hour shift costs you {money(ex.business, { exact: true })}/hour.
              The fee covers payments, call routing, recording and summaries, and dispute protection. A Redial Business line is required.
            </p>
          </div>
        </div>
      </section>

      <FaqSection items={FAQ} title="Questions about Live Agents" />

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] px-6 py-14 text-center text-white sm:px-12">
            <Headset className="mx-auto size-8 text-white/80" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Find the right voice for your business.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Browse Live Agents now, or tell us what you need and we&apos;ll match you.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="bg-white text-neutral-900 hover:bg-white/90" nativeButton={false} render={<Link href="/live-agents" />}>Browse Live Agents <ArrowRight /></Button>
              <InterestButton kind="business" size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" source="/live-agents/how-it-works#cta">Request coverage</InterestButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
