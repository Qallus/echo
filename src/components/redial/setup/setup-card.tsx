import Link from "next/link";
import { ArrowRight, AudioLines, Check, Circle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SETUP_STEPS } from "@/lib/redial/setup";
import { loadSetup, readiness } from "@/lib/redial/setup-data";

// Top of the dashboard home until Redial is set up: how far along the setup
// is, what's ready, and the way back in. Hidden once there's a line.
export async function RedialSetupCard() {
  const ctx = await loadSetup();
  if (ctx.line) return null;
  const { setup } = ctx;
  const ready = readiness(ctx);
  const answered = SETUP_STEPS.filter((s) => s.key in setup.answers).length;
  const waiting = setup.status === "submitted";

  return (
    <section className="overflow-hidden rounded-2xl border">
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em]"><AudioLines className="size-4" /> REDIAL</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {waiting ? "We're getting your Redial number ready" : setup.status === "needs_info" ? "We need a little more information" : "Finish setting up Redial"}
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {waiting
              ? "Your setup is in. Your number shows up here and in Calls as soon as it's ready, with the code to forward your calls."
              : setup.status === "needs_info"
                ? setup.staff_note ?? "Check your answers and finish setup again."
                : "Let DJ answer the calls you can't, so the ones that matter still reach you. It takes about five minutes."}
          </p>
          {!waiting && (
            <div className="flex items-center gap-3 pt-1">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={SETUP_STEPS.length} aria-valuenow={answered} aria-label="Setup progress">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${(answered / SETUP_STEPS.length) * 100}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{answered} of {SETUP_STEPS.length} steps</span>
            </div>
          )}
        </div>
        <Button nativeButton={false} render={<Link href="/setup" />} variant={waiting ? "outline" : "default"}>
          {waiting ? "Review your answers" : answered ? "Continue setup" : "Set up Redial"} <ArrowRight />
        </Button>
      </div>
      <ul className="grid gap-x-6 gap-y-2 border-t bg-muted/30 px-6 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {ready.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.done ? <Check className="size-4 text-emerald-600" /> : r.key === "number" && waiting ? <Info className="size-4 text-muted-foreground" /> : <Circle className="size-4 text-muted-foreground" />}
            <span className={r.done ? "" : "text-muted-foreground"}>{r.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
