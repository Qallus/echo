import Link from "next/link";
import { AudioLines, Check } from "lucide-react";
import { SETUP_STEPS } from "@/lib/redial/setup";
import { cn } from "@/lib/utils";

// The frame around each setup step: progress across the top (steps you've
// reached are links), and a way out.
export function SetupShell({ step, reached, children }: { step: number; reached: number; children: React.ReactNode }) {
  const current = SETUP_STEPS.find((s) => s.n === step)!;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em]"><AudioLines className="size-4" />REDIAL</span>
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">Finish later</Link>
      </div>
      <ol className="mt-6 flex gap-2" aria-label="Setup progress">
        {SETUP_STEPS.map((s) => {
          const done = s.n < step;
          const open = s.n <= reached;
          const bar = <span className={cn("block h-1.5 rounded-full", s.n <= step ? "bg-foreground" : "bg-muted")} />;
          return (
            <li key={s.n} className="min-w-0 flex-1">
              {open && s.n !== step ? <Link href={`/setup/${s.n}`} aria-label={`Step ${s.n}: ${s.title}`}>{bar}</Link> : bar}
              <span className={cn("mt-1.5 flex items-center gap-1 truncate text-[11px]", s.n === step ? "font-medium" : "text-muted-foreground")}>
                {done && <Check className="size-3 shrink-0" />}{s.short}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-sm text-muted-foreground">Step {step} of {SETUP_STEPS.length}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{current.title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

// A selectable card for single-choice answers.
export function Choice({ selected, onSelect, title, detail, tag, className }: {
  selected: boolean; onSelect: () => void; title: string; detail?: string; tag?: string; className?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors", selected ? "border-foreground bg-muted/50" : "hover:bg-muted/40", className)}>
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", selected && "border-foreground bg-foreground text-background")}>
        {selected && <Check className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-medium">{title}{tag && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">{tag}</span>}</span>
        {detail && <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>}
      </span>
    </button>
  );
}
