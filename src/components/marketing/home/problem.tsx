import { BellOff, PhoneMissed, ShieldAlert } from "lucide-react";

const CARDS = [
  { icon: ShieldAlert, title: "Spam and sales calls", desc: "Robocalls, “quick questions” and pitches look exactly like a real caller on your screen." },
  { icon: PhoneMissed, title: "The call you missed", desc: "Ignore an unknown number and it might have been a new client, the school or your doctor." },
  { icon: BellOff, title: "A broken focus", desc: "Every ring pulls you out of a meeting, a job or dinner, even when it turns out to be nothing." },
];

// Homepage, right after the hero: the problem Redial solves.
export function ProblemSection() {
  return (
    <section id="redial" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">The problem</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Every call rings the same.</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Spam, sales pitches and the one call that matters all look alike. So you either answer everything, or risk missing what&apos;s important.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {CARDS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-muted/30 p-6">
              <span className="flex size-10 items-center justify-center rounded-full border bg-background"><Icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-lg">
          <span className="font-semibold">Redial fixes that.</span>{" "}
          <span className="text-muted-foreground">Your AI assistant, DJ, answers first, finds out who&apos;s calling and why, and only interrupts you when it matters.</span>
        </p>
      </div>
    </section>
  );
}
