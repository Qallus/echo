import { AudioLines, Bot, Gavel, Headphones, MessageSquare, PhoneIncoming, ShieldCheck } from "lucide-react";
import { AgentName, Named } from "@/components/marketing/agent-name";

// Homepage: what happens to a call, in four steps, each with a small picture
// of what you'd see.
export function CallFlowSection() {
  return (
    <section id="how-redial" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">How Redial handles a call</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">From the first ring to your decision, in seconds.</h2>
        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Step n={1} title="A call comes in" desc="An unknown number rings. Your phone doesn't have to.">
            <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-3 text-white">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-lg">?</span>
              <div className="min-w-0 text-xs"><p className="font-semibold">Unknown caller</p><p className="text-white/60">(480) 555-0142</p></div>
              <PhoneIncoming className="ml-auto size-4 animate-pulse text-emerald-400" />
            </div>
          </Step>
          <Step n={2} title="{agent} answers" desc="Your assistant picks up and asks who's calling and what it's about.">
            <div className="space-y-1.5 text-xs">
              <p className="flex gap-1.5 rounded-lg bg-muted px-2.5 py-2"><Bot className="mt-0.5 size-3 shrink-0" /> Hi, this is <AgentName />. Who&apos;s calling?</p>
              <p className="ml-6 rounded-lg bg-primary/10 px-2.5 py-2">It&apos;s Dana from Summit Roofing.</p>
            </div>
          </Step>
          <Step n={3} title="You see who and why" desc="A quiet alert with the caller, the reason and whether it's real.">
            <div className="rounded-xl border bg-background p-2.5 text-xs shadow-sm">
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><AudioLines className="size-3" /> REDIAL · now</p>
              <p className="mt-0.5 font-semibold">Dana Ortiz, Summit Roofing</p>
              <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="size-3" /> Real business, not spam</p>
            </div>
          </Step>
          <Step n={4} title="You decide" desc="Listen in, guide {agent}, take the call, transfer it, or just read the summary later.">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="flex items-center gap-1 rounded-full border bg-background px-2 py-1"><Headphones className="size-3" /> Listen</span>
              <span className="flex items-center gap-1 rounded-full bg-foreground px-2 py-1 text-background"><Gavel className="size-3" /> Take over</span>
              <span className="flex items-center gap-1 rounded-full border bg-background px-2 py-1"><MessageSquare className="size-3" /> Summary</span>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border bg-background p-5">
      <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{n}</span>
      <h3 className="mt-4 font-semibold"><Named text={title} /></h3>
      <p className="mt-1 text-sm text-muted-foreground"><Named text={desc} /></p>
      <div className="mt-5 flex flex-1 items-end">{<div className="w-full">{children}</div>}</div>
    </li>
  );
}
