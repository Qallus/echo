"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, PhoneForwarded } from "lucide-react";
import { carrier, forwardingCode } from "@/lib/redial/carriers";
import { ROUTES, type RouteAnswers } from "@/lib/redial/setup";
import { Choice } from "./setup-shell";
import { StepActions } from "./step-actions";

// Step 3: how calls reach Redial. Keeping your number means forwarding on
// your carrier; this shows the code you'll dial once your Redial number is
// ready (or where to set it when there's no code).
export function RouteStep({ initial, carrierId, lineType, redialNumber }: { initial?: Partial<RouteAnswers>; carrierId?: string; lineType?: string; redialNumber?: string | null }) {
  const [method, setMethod] = useState(initial?.method ?? "missed");
  const c = carrier(carrierId);
  const mobile = !lineType || lineType === "mobile";
  const code = mobile && (method === "missed" || method === "all") ? forwardingCode(carrierId, method, redialNumber) : null;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Pick how your assistant gets your calls. You can change this any time.</p>
      <div role="radiogroup" aria-label="How calls reach Redial" className="grid gap-2">
        {ROUTES.map((r) => (
          <Choice key={r.id} selected={method === r.id} onSelect={() => setMethod(r.id)} title={r.label} detail={r.detail} tag={"tag" in r ? r.tag : undefined} />
        ))}
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        {method === "port" ? (
          <div className="space-y-1">
            <p className="flex gap-2"><PhoneForwarded className="mt-0.5 size-4 shrink-0" />Have your current bill handy: the transfer needs the account number, the service address and (for mobile numbers) a transfer PIN from your carrier.</p>
            <p className="pl-6 text-muted-foreground">Fill in the transfer form any time: <Link href="/calls/port" className="underline">Bring your number</Link>. Keep your old service until the transfer date.</p>
          </div>
        ) : method === "new_number" ? (
          <p className="flex gap-2"><PhoneForwarded className="mt-0.5 size-4 shrink-0" />We&apos;ll set up a Redial number for you. Share it, put it on your website, or use it for one part of your life.</p>
        ) : code ? (
          <div className="space-y-2">
            <p className="flex gap-2 font-medium"><PhoneForwarded className="mt-0.5 size-4 shrink-0" />What you&apos;ll do on your {c?.label ?? "phone"}</p>
            <p className="text-muted-foreground">{code.ready ? "Open your phone app, dial this and press Call:" : "Once your Redial number is ready, open your phone app, dial this and press Call:"}</p>
            <p className="font-mono text-base font-semibold tabular-nums">{code.on}</p>
            <p className="text-muted-foreground">To turn it off later, dial <span className="font-mono">{code.off}</span>. Codes can differ by plan; your carrier can confirm.</p>
            {c?.note && <p className="text-muted-foreground">{c.note}</p>}
          </div>
        ) : (
          <p className="flex gap-2 text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />
            {c?.note ?? (mobile
              ? "Look up “conditional call forwarding” or “forward unanswered calls” in your carrier's help. We'll give you the number to forward to once it's ready."
              : "Turn on call forwarding in your phone service's settings or admin portal. We'll give you the number to forward to once it's ready.")}
          </p>
        )}
      </div>

      <StepActions step={3} values={{ method }} />
    </div>
  );
}
