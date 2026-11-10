import { Ban, Eye, Hand, MessageSquareQuote } from "lucide-react";

const POINTS = [
  { icon: MessageSquareQuote, title: "You choose how DJ introduces itself", desc: "Write its greeting and decide whether it says it's an AI assistant. It never pretends to be you." },
  { icon: Eye, title: "Your calls stay yours", desc: "Only you see your calls and summaries, unless you share a line. Then each person gets only what you allow." },
  { icon: Hand, title: "You're always in control", desc: "VIPs ring straight through. Pause screening, take over or transfer any call, any time." },
  { icon: Ban, title: "Spam stops at the door", desc: "Blocked numbers never get through, and anyone who asks to stop hearing from you is honored." },
];

// Homepage: trust and control.
export function TrustSection() {
  return (
    <section id="trust" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">Trust and control</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">An assistant that works for you, on your terms.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-background p-6">
              <Icon className="size-5" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
