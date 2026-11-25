"use client";

import { LayoutDashboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// First visit: how do you want to start? Standard (everything laid out) or
// Blank (a guided start, then you add only what you want).
export function StartChooser({ name, onPick }: { name: string; onPick: (t: "standard" | "blank") => void }) {
  const options = [
    { id: "standard" as const, icon: LayoutDashboard, title: "Standard", desc: "Get started, search, weather, your notifications and what's next, every stat, and what's new. Change anything later.",
      preview: [["w-full"], ["w-1/2", "w-1/6", "w-1/6", "w-1/6"], ["w-1/3", "w-1/3", "w-1/3"], ["w-1/6", "w-1/6", "w-1/6", "w-1/6", "w-1/6", "w-1/6"]] },
    { id: "blank" as const, icon: Sparkles, title: "Blank", desc: "A guided start. Pick the few cards you care about: a dialpad, your calendar, a notepad, charts and more.",
      preview: [["w-full"], ["w-1/3"]] },
  ];
  return (
    <section className="rounded-3xl border bg-gradient-to-br from-muted/60 via-background to-background p-5 sm:p-8">
      <p className="text-sm text-muted-foreground">Welcome{name ? `, ${name}` : ""}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">How do you want your dashboard?</h1>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">Every card can be moved, resized, hidden or removed, and you can add more any time.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onPick(o.id)}
            className="group flex flex-col gap-4 rounded-2xl border bg-card p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring">
            <div className="space-y-1.5 rounded-xl bg-muted/60 p-3" aria-hidden>
              {o.preview.map((row, i) => (
                <div key={i} className="flex gap-1.5">{row.map((w, j) => <span key={j} className={cn("h-5 rounded-md bg-background shadow-xs", w)} />)}</div>
              ))}
              {o.id === "blank" && <div className="flex h-11 items-center justify-center rounded-md border-2 border-dashed text-[10px] text-muted-foreground">+ Add card</div>}
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold"><o.icon className="size-4" /> {o.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
