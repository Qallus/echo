import Link from "next/link";
import { ArrowRight, PhoneForwarded, PhoneIncoming, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARRIERS } from "@/lib/redial/carriers";
import { Named } from "@/components/marketing/agent-name";

const WAYS = [
  { icon: PhoneForwarded, title: "Forward the calls you miss", desc: "Your phone rings first. Anything you don't pick up goes to {agent} instead of voicemail." },
  { icon: Smartphone, title: "Forward everything", desc: "Your phone stays quiet. {agent} answers every call and puts the right ones through." },
  { icon: PhoneIncoming, title: "Get a Redial number", desc: "A separate number for your business or one part of your life. Calls to it always reach {agent}." },
];

// Homepage: works with the phone and number you already have.
export function KeepNumberSection() {
  const shown = CARRIERS.filter((c) => c.id !== "other").slice(0, 12);
  return (
    <section id="keep-your-number" className="scroll-mt-20 border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Keep your number</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">No new phone. No new number. Unless you want one.</h2>
          <ul className="mt-8 space-y-5">
            {WAYS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted/40"><Icon className="size-5" /></span>
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-muted-foreground"><Named text={desc} /></span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center rounded-2xl border bg-muted/30 p-6">
          <p className="font-semibold">Works with your carrier</p>
          <p className="mt-1 text-sm text-muted-foreground">Setup shows you the exact code to dial for yours. It takes about a minute.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {shown.map((c) => <span key={c.id} className="rounded-full border bg-background px-3 py-1.5 text-sm">{c.label}</span>)}
            <span className="rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground">and more</span>
          </div>
          <Button variant="outline" className="mt-6 self-start" nativeButton={false} render={<Link href="/compatibility" />}>Check your carrier <ArrowRight /></Button>
        </div>
      </div>
    </section>
  );
}
