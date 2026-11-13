"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Back / Continue for a Live Agent setup step. `save` returns an error
// message or nothing; on success the next step opens.
export function StepFooter({ step, save, label = "Continue", disabled, extra }: {
  step: number; save: () => Promise<{ error?: string } | void>; label?: string; disabled?: boolean; extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    setError(undefined);
    const r = await save().catch(() => ({ error: "Couldn't save. Check your connection and try again." }));
    if (r?.error) return setError(r.error);
    router.push(`/agent-desk/setup/${step + 1}`);
  });
  return (
    <div className="mt-8 space-y-3 border-t pt-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 1 ? <Button variant="ghost" nativeButton={false} render={<Link href={`/agent-desk/setup/${step - 1}`} />}><ArrowLeft /> Back</Button> : <span />}
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          <Button disabled={pending || disabled} onClick={go}>{pending ? "Saving…" : label}{!pending && <ArrowRight />}</Button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={className ?? "block space-y-1.5"}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// A toggle chip for multi-select lists (skills, languages, industries).
export function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}
