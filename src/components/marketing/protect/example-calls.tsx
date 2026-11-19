"use client";

import { useState } from "react";
import { CircleCheck, CircleHelp, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

// /protect: example calls, each with what the caller said, what Redial
// checked and the verdict. Names, numbers and businesses are made up.

type Verdict = "legit" | "unverified" | "scam";
const CALLS: { tab: string; say1: string; ask: string; say2: string; checks: string[]; verdict: Verdict; outcome: string }[] = [
  {
    tab: "Grandchild in jail",
    say1: "Grandma? It's me. I got in a car accident and they arrested me. I need bail money right away.",
    ask: "I'm sorry to hear that. What's the family code word?",
    say2: "I don't have time. Just get $5,000 in gift cards and please don't tell Mom.",
    checks: ["Couldn't give the family code word", "Call-back: Tyler answered his saved number and is safe", "Bail, gift cards and secrecy: a known scam story"],
    verdict: "scam", outcome: "Call ended and number blocked. Karen got a text.",
  },
  {
    tab: "Fake lawyer and courier",
    say1: "This is Attorney Daniel Brooks. I represent Ruth's grandson. Bail is $8,500.",
    ask: "Which court and case number, so Ruth can call the court?",
    say2: "No time. A courier will come to her house in an hour for the cash. Keep it confidential.",
    checks: ["Wouldn't name a court or case number", "Cash courier coming to the house", "Asked to keep it secret"],
    verdict: "scam", outcome: "Call ended. The family is warned not to open the door.",
  },
  {
    tab: "Cloned voice",
    say1: "Mom? It's Karen. [crying] I've been in an accident. I need you to wire money for the hospital.",
    ask: "I'm here to help. What's the family code word?",
    say2: "Mom, please, I can't think. Just send it. The man will text you the account.",
    checks: ["The voice sounds right, but no code word", "Call-back: Karen is safe at work", "A wire transfer to a stranger's account"],
    verdict: "scam", outcome: "Call ended. A voice can be copied; the code word can't.",
  },
  {
    tab: "Medicare caller",
    say1: "This is the Medicare benefits office. Ruth's new card is ready to mail.",
    ask: "Thank you. What do you need from her?",
    say2: "Her Medicare number and bank details, or her coverage lapses today.",
    checks: ["Asked for a Medicare number and bank details", "A same-day deadline", "Medicare says it won't call out of the blue asking for these"],
    verdict: "scam", outcome: "Call ended. Nothing was shared.",
  },
  {
    tab: "The pharmacy",
    say1: "Hi, this is Lena at Desert Sky Pharmacy on Ray Road.",
    ask: "Thanks, Lena. What's the call about?",
    say2: "Ruth's prescription is ready for pickup. No need to call back.",
    checks: ["No money, codes or personal details asked for", "A clear, everyday reason to call"],
    verdict: "legit", outcome: "Message saved with a summary: prescription ready.",
  },
];

const VERDICT: Record<Verdict, { label: string; icon: typeof ShieldX; tone: string }> = {
  legit: { label: "Looks legit", icon: CircleCheck, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  unverified: { label: "Can't verify", icon: CircleHelp, tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  scam: { label: "Likely scam", icon: ShieldX, tone: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

export function ExampleCalls() {
  const [i, setI] = useState(0);
  const c = CALLS[i];
  const V = VERDICT[c.verdict];
  return (
    <div className="mt-10 space-y-4">
      <div role="tablist" aria-label="Example calls" className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1 [scrollbar-width:none]">
        {CALLS.map((x, k) => (
          <button key={x.tab} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)}
            className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap", k === i ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {x.tab}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="grid gap-4 md:grid-cols-2">
        <div className="space-y-5 rounded-2xl border bg-background p-5 sm:p-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What the caller said</p>
          <Bubble who="Caller · 0:06" text={c.say1} caller />
          <Bubble who="Redial · 0:14" text={c.ask} />
          <Bubble who="Caller · 0:19" text={c.say2} caller />
        </div>
        <div className="flex flex-col rounded-2xl border bg-background p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What Redial checked</p>
          <ul className="mt-3 space-y-2 text-sm">
            {c.checks.map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/60" />{x}</li>)}
          </ul>
          <div className="mt-auto pt-5">
            <p className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", V.tone)}><V.icon className="size-3.5" /> {V.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{c.outcome}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Example calls. Names, numbers and businesses are made up.</p>
    </div>
  );
}

function Bubble({ who, text, caller }: { who: string; text: string; caller?: boolean }) {
  return (
    <div className={cn("max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed", caller ? "ml-auto bg-foreground text-background" : "bg-muted")}>
      <span className="mb-1 block text-[10px] font-semibold opacity-60">{who}</span>{text}
    </div>
  );
}
