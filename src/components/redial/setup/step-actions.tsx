"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSetupStep } from "@/lib/redial/setup-actions";
import { LAST_STEP } from "@/lib/redial/setup";

// Back / Continue for a setup step: saves the step's answers, then moves on.
// After the last step it goes back to the dashboard.
export function StepActions({ step, values, disabled }: { step: number; values: unknown; disabled?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const last = step === LAST_STEP;
  const go = () => start(async () => {
    setError(null);
    const res = await saveSetupStep(step, values).catch(() => ({ error: "Couldn't save. Check your connection and try again." }));
    if (res.error) return setError(res.error);
    router.push(last ? "/home?setup=saved" : `/setup/${step + 1}`);
  });
  return (
    <div className="mt-8 space-y-3 border-t pt-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        {step > 1 ? <Button variant="ghost" nativeButton={false} render={<Link href={`/setup/${step - 1}`} />}><ArrowLeft /> Back</Button> : <span />}
        <Button disabled={pending || disabled} onClick={go}>{pending ? "Saving…" : last ? "Save" : "Continue"}{!pending && !last && <ArrowRight />}</Button>
      </div>
    </div>
  );
}
