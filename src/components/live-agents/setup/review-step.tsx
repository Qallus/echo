"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, CircleCheck, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitAgentProfile } from "@/lib/live-agents/agent-actions";

export type ReviewRow = { step: number; label: string; value: string; ok: boolean };

// Step 8: everything at a glance with links back to each step, what's still
// missing, and "Send for review".
export function ReviewStep({ rows, gaps, status }: { rows: ReviewRow[]; gaps: { step: number; label: string }[]; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    setError(undefined);
    const r = await submitAgentProfile();
    if (r.error) setError(r.error); else router.push("/agent-desk?sent=1");
  });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        {status === "draft"
          ? "Check your profile, then send it to the Redial team. Reviews usually take about one business day; we'll email you when you're live."
          : "Your profile has been sent. Changes you make now are saved right away."}
      </p>

      <ul className="divide-y rounded-2xl border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 px-4 py-3">
            {r.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="truncate text-sm text-muted-foreground">{r.value}</p>
            </div>
            <Link href={`/agent-desk/setup/${r.step}`} className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Edit</Link>
          </li>
        ))}
      </ul>

      {gaps.length > 0 && status === "draft" && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Before you send it</p>
          <ul className="mt-2 space-y-1">
            {gaps.map((g) => <li key={g.label}><Link href={`/agent-desk/setup/${g.step}`} className="underline underline-offset-2">{g.label}</Link></li>)}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        After approval you&apos;ll verify your ID and set up payouts through Stripe before taking paid work. By sending your profile you agree to keep calls,
        messages and payments on Redial.
      </div>

      <div className="space-y-3 border-t pt-5">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" nativeButton={false} render={<Link href="/agent-desk/setup/7" />}><ArrowLeft /> Back</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/agent-desk/preview" />}><Eye /> Preview</Button>
            {status === "draft"
              ? <Button disabled={pending || gaps.length > 0} onClick={send}><Send /> {pending ? "Sending…" : "Send for review"}</Button>
              : <Button nativeButton={false} render={<Link href="/agent-desk" />}>Go to Agent Desk</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
