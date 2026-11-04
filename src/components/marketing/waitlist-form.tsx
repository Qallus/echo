"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { joinWaitlist } from "@/lib/waitlist";
import { CONSENT, PLATFORMS, PRODUCTS, SMS_FREQUENCIES, TEAM_SIZES, UPDATE_TOPICS, USE_CASES, type Platform } from "@/lib/waitlist-options";
import { cn } from "@/lib/utils";

const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));

// "Get notified" for the mobile apps: who they are, which app and products,
// personal or business, what they'd use it for, and how we may contact them.
export function WaitlistForm({ platform, source, onBack }: { platform: Platform; source: string; onBack: () => void }) {
  const [platforms, setPlatforms] = useState<string[]>([platform]);
  const [products, setProducts] = useState<string[]>(["echo"]);
  const [type, setType] = useState<"personal" | "business">("personal");
  const [sms, setSms] = useState(false);
  const [call, setCall] = useState(false);
  const [frequency, setFrequency] = useState("major");
  const [topics, setTopics] = useState<string[]>(["launch", "beta"]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-8 text-emerald-600" />
        <p className="text-lg font-medium">You&apos;re on the list.</p>
        <p className="text-sm text-muted-foreground">We&apos;ll be in touch as soon as the app is ready. In the meantime, Echo works in your browser.</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (!platforms.length) { setError("Choose iPhone, Android or both."); return; }
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      setError(undefined);
      start(async () => {
        const r = await joinWaitlist({ ...f, platforms, products, account_type: type, consent_sms: sms, consent_call: call, sms_frequency: frequency, update_topics: topics, source_page: source });
        if (r.error) setError(r.error); else setDone(true);
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="w-first" label="First name"><Input id="w-first" name="first_name" required autoComplete="given-name" maxLength={100} /></Field>
        <Field id="w-last" label="Last name"><Input id="w-last" name="last_name" required autoComplete="family-name" maxLength={100} /></Field>
        <Field id="w-email" label="Email"><Input id="w-email" name="email" type="email" required autoComplete="email" maxLength={200} /></Field>
        <Field id="w-phone" label="Mobile phone"><PhoneInput id="w-phone" name="phone" required /></Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Which app?</legend>
        <div className="flex flex-wrap gap-4">
          {PLATFORMS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox checked={platforms.includes(p.id)} onCheckedChange={(v) => setPlatforms(toggle(platforms, p.id, Boolean(v)))} />{p.label}</label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What do you want in the app?</legend>
        {PRODUCTS.map((p) => (
          <label key={p.id} className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={products.includes(p.id)} onCheckedChange={(v) => setProducts(toggle(products, p.id, Boolean(v)))} />
            <span><span className="font-medium">{p.label}</span> <span className="text-muted-foreground">· {p.detail}</span></span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">For</legend>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
          {(["personal", "business"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
              className={cn("flex-1 rounded-md px-3 py-1.5 font-medium capitalize", type === t ? "bg-card shadow-sm" : "text-muted-foreground")}>{t}</button>
          ))}
        </div>
      </fieldset>

      {type === "business" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="w-company" label="Company"><Input id="w-company" name="company" autoComplete="organization" maxLength={200} /></Field>
          <Field id="w-team" label="Team size">
            <select id="w-team" name="team_size" className={SELECT} defaultValue="">
              <option value="" disabled>Choose</option>{TEAM_SIZES.map((s) => <option key={s} value={s}>{s === "1" ? "Just me" : `${s} people`}</option>)}
            </select>
          </Field>
        </div>
      )}

      <Field id="w-use" label="Main use">
        <select id="w-use" name="use_case" className={SELECT} defaultValue="">
          <option value="">Choose (optional)</option>{USE_CASES.map((u) => <option key={u}>{u}</option>)}
        </select>
      </Field>
      <Field id="w-details" label="Tell us how you'd use it (optional)"><Textarea id="w-details" name="details" rows={2} maxLength={2000} /></Field>
      <Field id="w-questions" label="Questions or comments (optional)"><Textarea id="w-questions" name="questions" rows={2} maxLength={4000} /></Field>

      <fieldset className="space-y-2 rounded-lg border p-3 text-xs text-muted-foreground">
        <legend className="px-1 text-sm font-medium text-foreground">How we can reach you</legend>
        <div className="space-y-1.5">
          <p className="text-foreground">Send me</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {UPDATE_TOPICS.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-foreground"><Checkbox checked={topics.includes(t.id)} onCheckedChange={(v) => setTopics(toggle(topics, t.id, Boolean(v)))} />{t.label}</label>
            ))}
          </div>
        </div>
        <p>{CONSENT.email}</p>
        <label className="flex items-start gap-2"><Checkbox className="mt-0.5" checked={sms} onCheckedChange={(v) => setSms(Boolean(v))} /><span>{CONSENT.sms}</span></label>
        {sms && (
          <div className="space-y-1 pl-6">
            <label htmlFor="w-freq" className="text-foreground">How often may we text?</label>
            <select id="w-freq" className={SELECT} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {SMS_FREQUENCIES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        )}
        <label className="flex items-start gap-2"><Checkbox className="mt-0.5" checked={call} onCheckedChange={(v) => setCall(Boolean(v))} /><span>{CONSENT.call}</span></label>
        <p>Texts and calls are optional and not a condition of anything. See our <a href="/privacy" className="underline">Privacy Policy</a>.</p>
      </fieldset>

      {/* Left empty by people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
        <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Saving…" : "Notify me"}</Button>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
