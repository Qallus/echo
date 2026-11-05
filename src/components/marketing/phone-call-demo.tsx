"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bot, Check, Gavel, PhoneIncoming, User } from "lucide-react";
import { DEMO_CALL } from "@/lib/redial/demo-call";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";

// The mobile app section's phone: a short Redial call on a loop. The
// assistant screens Mike, you take over with Gavel, and the rest of the call
// is recorded and transcribed (script: src/lib/redial/demo-call.ts). With
// reduced motion on, it shows the end.

const { lines: LINES, named: NAMED, press: PRESS, tookOver: TOOK_OVER, ended: ENDED, loop: LOOP } = DEMO_CALL;
const TICK = 100;

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function PhoneCallDemo() {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setClock((c) => (c + TICK) % LOOP), TICK);
    return () => clearInterval(id);
  }, [reduced]);
  const t = reduced ? LOOP : clock;

  const caller = t >= NAMED ? DEMO_CALL.caller : DEMO_CALL.number;
  const yours = t >= TOOK_OVER;
  const ended = t >= ENDED;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
      <div className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 px-2.5 py-2">
        {ended ? <Check className="size-3.5" /> : <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
        <span className="min-w-0 truncate font-semibold">{ended ? "Ended" : t < 1500 ? "Incoming call" : "Live"}: {caller}</span>
        {!ended && <PhoneIncoming className="ml-auto size-3 shrink-0" />}
      </div>

      <div className="text-center text-[9px] text-muted-foreground">
        {ended ? "Recording and transcript saved" : yours ? (
          <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
            <span className="size-1.5 animate-pulse rounded-full bg-current" /> You took over · recording and transcribing
          </span>
        ) : t < 1500 ? "Your assistant is answering" : "Your assistant is screening"}
      </div>

      {/* Newest line at the bottom; older ones scroll off the top. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden">
        {LINES.filter((l) => l.at <= t).map((l) => (
          <div key={l.at} className={cn(
            "hero-in flex max-w-[88%] gap-1.5 rounded-lg px-2 py-1.5",
            l.who === "caller" ? "ml-auto bg-primary/10" : l.who === "you" ? "bg-emerald-500/10" : "bg-muted",
          )}>
            {l.who === "ai" ? <Bot className="mt-px size-3 shrink-0" /> : <User className="mt-px size-3 shrink-0" />}
            <span>
              <span className="block text-[8px] font-medium text-muted-foreground">
                {l.who === "ai" ? "Assistant" : l.who === "you" ? "You" : l.at >= NAMED ? "Mike" : "Caller"}
              </span>
              {l.text}
            </span>
          </div>
        ))}
      </div>

      <div className="flex h-8 shrink-0 items-center justify-center">
        {!yours ? (
          <span className={cn(
            "flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-transform",
            t >= PRESS && "scale-95 ring-4 ring-foreground/20",
          )}>
            <Gavel className="size-3.5" /> {t >= PRESS ? "Taking over…" : FEATURES.gavel.action}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">{ended ? "Summary and action items are ready" : "The assistant left. Same call, Mike never redialed."}</span>
        )}
      </div>
    </div>
  );
}
