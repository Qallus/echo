"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Circle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/components/ui/phone-input";
import { findPrice, money, per } from "@/lib/billing/catalog";
import { carrier } from "@/lib/redial/carriers";
import { finishSetup } from "@/lib/redial/setup-actions";
import { ROUTES, SCREEN_MODES, UPDATES, type Setup } from "@/lib/redial/setup";
import { VOICES } from "@/lib/redial/types";
import { CONSENT } from "@/lib/waitlist-options";
import { cn } from "@/lib/utils";

type Item = { key: string; label: string; done: boolean };

// Step 8: everything on one page with links back, what's ready, the
// consents, and Finish (then checkout for a paid plan).
export function ReviewStep({ setup, ready, line }: { setup: Setup; ready: Item[]; line: { number: string } | null }) {
  const router = useRouter();
  const a = setup.answers;
  const [terms, setTerms] = useState(a.review?.terms ?? false);
  const [updates, setUpdates] = useState(a.review?.updates ?? "none");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const plan = a.plan?.priceKey ? findPrice(a.plan.priceKey) : null;

  const sections = [
    { n: 1, title: "You", lines: [a.about?.fullName, a.about?.accountType === "business" ? `Business: ${a.about.company}` : "Personal", a.about?.phone && formatPhone(a.about.phone)] },
    { n: 2, title: "Your phone", lines: [a.phone?.lineType === "mobile" ? carrier(a.phone.carrier)?.label : a.phone?.provider, a.phone?.device && a.phone.device !== "desk" ? (a.phone.device === "iphone" ? "iPhone" : a.phone.device === "android" ? "Android" : undefined) : undefined] },
    { n: 3, title: "How calls reach Redial", lines: [ROUTES.find((r) => r.id === a.route?.method)?.label] },
    { n: 4, title: "Who gets screened", lines: [SCREEN_MODES.find((m) => m.id === a.screening?.mode)?.label, a.screening?.vip?.length ? `${a.screening.vip.length} VIP` : undefined, a.screening?.block?.length ? `${a.screening.block.length} blocked` : undefined] },
    { n: 5, title: "Your assistant", lines: [a.assistant?.name && `${a.assistant.name}, voice ${VOICES.find((v) => v.id === a.assistant?.voice)?.label ?? ""}`, a.assistant?.disclose ? "Says it's an AI assistant" : a.assistant ? "Doesn't say it's AI" : undefined] },
    { n: 6, title: "After the call", lines: [a.after?.putThrough ? `Puts important calls through${a.after.forwardTo ? ` to ${formatPhone(a.after.forwardTo)}` : " in the app"}` : a.after ? "Takes a message" : undefined, a.after?.directory?.length ? `${a.after.directory.length} transfer ${a.after.directory.length === 1 ? "contact" : "contacts"}` : undefined] },
    { n: 7, title: "Plan", lines: [plan ? `${plan.product.name}${a.plan?.quantity && a.plan.quantity > 1 ? ` · ${a.plan.quantity} lines` : ""} · ${money(plan.price.unitAmount ?? 0)}${plan.product.perSeat ? " per line" : ""}${per(plan.price.interval)}` : a.plan ? "Redial Free" : undefined] },
  ];

  const finish = () => start(async () => {
    setMsg({});
    const res = await finishSetup({ terms, updates }).catch(() => ({ error: "Couldn't save. Check your connection and try again." }) as { error: string; url?: string; ok?: string });
    if (res.error) return setMsg({ error: res.error });
    if (res.url) { window.location.href = res.url; return; }
    setMsg({ ok: res.ok });
    router.push("/home?setup=done");
  });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Check everything, then finish. You can change any of it later.</p>

      <ul className="divide-y rounded-xl border">
        {sections.map((s) => {
          const shown = s.lines.filter(Boolean);
          return (
            <li key={s.n} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.title}</p>
                <p className={cn("text-sm", shown.length ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>{shown.length ? shown.join(" · ") : "Not answered yet"}</p>
              </div>
              <Link href={`/setup/${s.n}`} className="text-sm underline underline-offset-4">Edit</Link>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-medium">Ready to go</p>
        <ul className="space-y-1.5 text-sm">
          {ready.map((r) => (
            <li key={r.key} className="flex items-center gap-2">
              {r.done ? <Check className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}
              <span className={r.done ? "" : "text-muted-foreground"}>{r.label}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 pt-1 text-sm">
          <PhoneCall className="mt-0.5 size-4 shrink-0" />
          {line
            ? <span>Try it: call <span className="font-medium">{formatPhone(line.number)}</span> from another phone and meet {a.assistant?.name ?? "your assistant"}.</span>
            : <span className="text-muted-foreground">We&apos;ll set up your Redial number after you finish. It shows on your dashboard and in Calls, and then you can try a test call.</span>}
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
          <span>I agree to the <Link href="/terms" target="_blank" className="underline">Terms of Service</Link> and <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>.</span>
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="su-updates">Text me Redial news and tips</Label>
          <select id="su-updates" value={updates} onChange={(e) => setUpdates(e.target.value)} className="h-9 w-full max-w-sm rounded-lg border bg-background px-2.5 text-sm">
            {UPDATES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          {updates !== "none" && <p className="text-xs text-muted-foreground">{CONSENT.sms.replace("Echo apps", "Redial")}</p>}
        </div>
      </div>

      {setup.status === "submitted" && <p className="text-sm text-muted-foreground">You&apos;ve already finished setup. Finishing again saves your changes.</p>}
      {(msg.ok || msg.error) && <p role="status" className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}
      <div className="flex items-center justify-between gap-3 border-t pt-5">
        <Button variant="ghost" nativeButton={false} render={<Link href="/setup/7" />}><ArrowLeft /> Back</Button>
        <Button disabled={pending || !terms} onClick={finish}>{pending ? "Finishing…" : plan ? "Finish and check out" : "Finish setup"}</Button>
      </div>
    </div>
  );
}
