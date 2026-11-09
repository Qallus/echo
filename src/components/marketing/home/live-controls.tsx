"use client";

import { useState } from "react";
import { AudioLines, Gavel, Headphones, MessageSquareLock, PhoneForwarded, Sparkles } from "lucide-react";
import { DeviceDemo } from "@/components/marketing/hero-demo/hero-demo";
import { REDIAL_CONTROL_SCENES } from "@/components/marketing/hero-demo/redial-scenes";
import { FEATURES } from "@/lib/redial/features";
import { cn } from "@/lib/utils";

const CONTROLS = [
  { key: "listen", icon: Headphones, f: FEATURES.insider, benefit: "Hear the call live without saying a word. Your microphone is never sent." },
  { key: "guide", icon: MessageSquareLock, f: FEATURES.audible, benefit: "Type private directions while DJ talks. The caller never hears them." },
  { key: "takeover", icon: Gavel, f: FEATURES.gavel, benefit: "Take the call yourself, on the same call. DJ steps away; the caller never hangs up." },
  { key: "transfer", icon: PhoneForwarded, f: FEATURES.directory, benefit: "Send the caller to the right teammate or number. They hear who's calling first." },
  { key: "mirror", icon: Sparkles, f: FEATURES.mirror, benefit: "While you talk, it quietly suggests answers from your notes and drafts follow-ups." },
] as const;
type Key = (typeof CONTROLS)[number]["key"];

// Homepage: the live call controls, one tab each, with its phone scene.
export function LiveControlsSection() {
  const [active, setActive] = useState<Key>("listen");
  return (
    <section id="controls" className="scroll-mt-20 border-t">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Live call controls</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Step in whenever you want. Or don&apos;t.</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">DJ handles the call, and you stay in control the whole time, from your phone or the web.</p>
          <div role="tablist" aria-label="Live call controls" className="mt-8 grid gap-2">
            {CONTROLS.map(({ key, icon: Icon, f, benefit }) => {
              const on = key === active;
              return (
                <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setActive(key)}
                  className={cn("flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors", on ? "border-foreground bg-muted/50" : "hover:bg-muted/40")}>
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", on ? "bg-foreground text-background" : "bg-muted")}><Icon className="size-5" /></span>
                  <span>
                    <span className="block font-semibold">{f.name} <span className="font-normal text-muted-foreground">· {f.action}</span></span>
                    <span className={cn("block text-sm text-muted-foreground", !on && "line-clamp-1")}>{benefit}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div role="tabpanel" aria-label={CONTROLS.find((c) => c.key === active)?.f.name} className="mx-auto w-full max-w-[300px] lg:max-w-none">
          <DeviceDemo key={active} phone hideNav scenes={[REDIAL_CONTROL_SCENES[active]]} title="Call from (480) 555-0142" Logo={AudioLines} />
        </div>
      </div>
    </section>
  );
}
