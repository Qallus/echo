"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContact } from "./actions";
import { PhoneInput } from "@/components/ui/phone-input";

const TOPICS = ["Sales", "Support", "Partnerships", "Billing", "Other"];
const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-10 text-center">
        <CheckCircle2 className="size-8 text-emerald-600" />
        <p className="text-lg font-medium">Thanks, we got your message.</p>
        <p className="text-sm text-muted-foreground">We&apos;ll reply by email within one business day.</p>
      </div>
    );
  }

  return (
    <form className="space-y-4 rounded-2xl border p-6" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      start(async () => { const res = await submitContact(f); if (res.error) setError(res.error); else setSent(true); });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" name="name" required autoComplete="name" /></div>
        <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" name="email" type="email" required autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="c-phone">Phone (optional)</Label><PhoneInput id="c-phone" name="phone" /></div>
        <div className="space-y-1.5"><Label htmlFor="c-company">Company (optional)</Label><Input id="c-company" name="company" autoComplete="organization" /></div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-topic">Topic</Label>
        <select id="c-topic" name="topic" className={SELECT} defaultValue="Sales">{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="c-msg">Message</Label><Textarea id="c-msg" name="message" required rows={5} maxLength={10000} /></div>
      {/* Left empty by people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
