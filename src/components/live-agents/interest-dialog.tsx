"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { sendLiveAgentInterest } from "@/lib/live-agents/actions";
import type { Skill } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// Until messaging and booking ship, "Message", "Request coverage" and
// "Apply" open this form. It reaches the Redial team as a CRM lead.

type Kind = "business" | "agent";

export function InterestButton({ kind, children, agentName, skills = [], source, variant = "default", size = "default", className }: {
  kind: Kind; children: React.ReactNode; agentName?: string; skills?: Skill[]; source: string;
  variant?: "default" | "outline" | "secondary" | "ghost"; size?: "default" | "sm" | "lg"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>{children}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90dvh] max-w-lg overflow-y-auto"
          title={kind === "agent" ? "Apply to become a Live Agent" : agentName ? `Message ${agentName}` : "Request Live Agent coverage"}
          description={kind === "agent"
            ? "Tell us a little about yourself. We're inviting the first Live Agents now and will email you the next steps."
            : agentName
              ? `In-app messaging opens soon. Tell us what you need and the Redial team will connect you with ${agentName}. Contact details stay private.`
              : "Tell us when you need people on your phones. The Redial team will match you with Live Agents and get you set up."}
        >
          <InterestForm kind={kind} agentName={agentName} skills={skills} source={source} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InterestForm({ kind, agentName, skills, source }: { kind: Kind; agentName?: string; skills: Skill[]; source: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [sms, setSms] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-8 text-emerald-600" />
        <p className="text-lg font-medium">Thanks, we&apos;ve got it.</p>
        <p className="text-sm text-muted-foreground">
          {kind === "agent" ? "We'll email you about next steps: your profile, voice samples and getting paid." : "Someone from Redial will reach out within one business day."}
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      setError(undefined);
      start(async () => {
        const languages = (f.languages ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const note = agentName ? `About ${agentName}: ${f.note ?? ""}` : f.note;
        const r = await sendLiveAgentInterest({ ...f, note, kind, phone, languages, skills: picked, consent_sms: sms, source_page: source });
        if (r.error) setError(r.error); else setDone(true);
      });
    }}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name"><Input name="first_name" required maxLength={100} autoComplete="given-name" /></Field>
        <Field label="Last name"><Input name="last_name" required maxLength={100} autoComplete="family-name" /></Field>
        <Field label="Email"><Input name="email" type="email" required maxLength={200} autoComplete="email" /></Field>
        <Field label="Phone (optional)"><PhoneInput value={phone} onChange={setPhone} /></Field>
        {kind === "business" ? (
          <>
            <Field label="Business name"><Input name="company" maxLength={200} autoComplete="organization" /></Field>
            <Field label="Hours you need covered"><Input name="hours" maxLength={200} placeholder="e.g. Lunch, after 5 pm, weekends" /></Field>
          </>
        ) : (
          <>
            <Field label="City and state"><Input name="city" maxLength={100} placeholder="e.g. Mesa, AZ" autoComplete="address-level2" /></Field>
            <Field label="Years answering phones"><Input name="years" inputMode="numeric" maxLength={3} placeholder="e.g. 5" /></Field>
            <Field label="Languages" className="sm:col-span-2"><Input name="languages" maxLength={200} placeholder="e.g. English, Spanish" /></Field>
          </>
        )}
      </div>
      {kind === "agent" && skills.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What you&apos;re great at</legend>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => {
              const on = picked.includes(s.slug);
              return (
                <button key={s.slug} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.slug) : [...p, s.slug]))}
                  className={cn("rounded-md border px-2 py-1 text-xs transition", on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <Field label={kind === "agent" ? "Anything else we should know?" : agentName ? "Your message" : "What should callers get help with?"}>
        <Textarea name="note" rows={3} maxLength={2000} required={Boolean(agentName)} />
      </Field>
      {phone && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} className="mt-0.5" />
          <span>Text me about Redial Live Agents. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to stop, HELP for help.</span>
        </label>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : kind === "agent" ? "Send application" : "Send"}</Button>
      <p className="text-xs text-muted-foreground">We&apos;ll use this only to follow up about Redial Live Agents.</p>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={cn("block space-y-1.5", className)}><span className="text-sm font-medium">{label}</span>{children}</label>;
}
