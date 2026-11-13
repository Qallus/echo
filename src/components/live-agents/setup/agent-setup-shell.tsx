import Link from "next/link";
import { AudioLines, Check, Eye, Info } from "lucide-react";
import { AGENT_STEPS } from "@/lib/live-agents/setup";
import { cn } from "@/lib/utils";

// The frame around each Live Agent setup step: progress (steps you've
// reached are links), the step title, and a side panel with profile
// strength and what businesses see.
export function AgentSetupShell({ step, reached, strength, note, hasProfile, children }: {
  step: number; reached: number; strength: number; note?: string | null; hasProfile: boolean; children: React.ReactNode;
}) {
  const current = AGENT_STEPS.find((s) => s.n === step)!;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em]"><AudioLines className="size-4" />REDIAL <span className="font-normal tracking-normal text-muted-foreground">Live Agents</span></span>
        <Link href="/agent-desk" className="text-sm text-muted-foreground hover:text-foreground">Save and finish later</Link>
      </div>
      <ol className="mt-6 flex gap-2" aria-label="Setup progress">
        {AGENT_STEPS.map((s) => {
          const open = hasProfile && s.n <= reached;
          const bar = <span className={cn("block h-1.5 rounded-full", s.n <= step ? "bg-foreground" : "bg-muted")} />;
          return (
            <li key={s.n} className="min-w-0 flex-1">
              {open && s.n !== step ? <Link href={`/agent-desk/setup/${s.n}`} aria-label={`Step ${s.n}: ${s.title}`}>{bar}</Link> : bar}
              <span className={cn("mt-1.5 hidden items-center gap-1 truncate text-[11px] sm:flex", s.n === step ? "font-medium" : "text-muted-foreground")}>
                {s.n < reached && s.n !== step && <Check className="size-3 shrink-0" />}{s.short}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="min-w-0">
          {note && <p className="mb-6 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><Info className="mt-0.5 size-4 shrink-0" /><span><span className="font-medium">From the Redial team:</span> {note}</span></p>}
          <p className="text-sm text-muted-foreground">Step {step} of {AGENT_STEPS.length}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{current.title}</h1>
          <div className="mt-6">{children}</div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">Profile strength</span><span className="text-muted-foreground">{strength}%</span></div>
            <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${strength}%` }} /></div>
            {hasProfile && <Link href="/agent-desk/preview" className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Eye className="size-4" /> Preview your profile</Link>}
          </div>
          <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">What businesses see</p>
            <p className="mt-1 text-muted-foreground">Your first name and last initial, photo, city, voice clips, skills, rates and reviews. Never your phone number, email, address or ID.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
