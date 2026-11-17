import Link from "next/link";
import { ArrowRight, Hash, MapPin, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Home page: get a new number. Real numbers people can pick on /numbers and
// buy at checkout ($5/mo, or $2.50/mo with any Redial plan).

const SAMPLES = [
  { number: "(206) 555-0148", place: "Seattle, WA" },
  { number: "(360) 555-0192", place: "Vancouver, WA" },
  { number: "(602) 555-CALL", place: "Phoenix, AZ", word: true },
  { number: "(888) 555-0110", place: "Toll-free" },
];

const POINTS = [
  { icon: MapPin, title: "Local anywhere", desc: "Seattle, Tacoma, Vancouver WA, Phoenix, Austin, New York and hundreds more area codes." },
  { icon: Sparkles, title: "Make it memorable", desc: "Search a word or the digits you want, like your business name or 2255." },
  { icon: Phone, title: "Ready in minutes", desc: "Your assistant answers it as soon as you check out. Works with the app and desk phones." },
];

export function NumbersCtaSection() {
  return (
    <section id="numbers" className="scroll-mt-20 border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_26rem] lg:items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Phone numbers</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Get the perfect number.</h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Pick a real local or toll-free number for your business, your side project or a parent&apos;s home line. <span className="font-medium text-foreground">$5 a month</span>, or <span className="font-medium text-foreground">$2.50 a month</span> with any Redial plan.
          </p>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted/40"><Icon className="size-5" /></span>
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-muted-foreground">{desc}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/numbers" />}><Hash /> Find my number</Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/#keep-your-number" />}>Keep my number instead <ArrowRight /></Button>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_0%_0%,#3f3f46_0%,#18181b_55%,#09090b_100%)] p-6 text-white shadow-xl">
          <span className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-3xl" />
          <p className="text-[11px] font-medium tracking-[0.18em] text-white/60 uppercase">Available now</p>
          <ul className="mt-4 space-y-2.5">
            {SAMPLES.map((s) => (
              <li key={s.number} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                <span>
                  <span className="block text-lg font-semibold tabular-nums">{s.word ? <>(602) 555-<span className="rounded bg-white/20 px-1">CALL</span></> : s.number}</span>
                  <span className="text-xs text-white/60">{s.place}</span>
                </span>
                <Link href="/numbers" className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-white/90">Get it</Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-white/50">Examples. Search to see the real numbers available right now.</p>
        </div>
      </div>
    </section>
  );
}
