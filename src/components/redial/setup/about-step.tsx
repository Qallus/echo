"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { confirmPhoneCheck, startPhoneCheck } from "@/lib/redial/setup-actions";
import { INDUSTRIES, TEAM_SIZES } from "@/lib/redial/setup";
import type { SetupContext } from "@/lib/redial/setup-data";
import { cn } from "@/lib/utils";
import { Choice } from "./setup-shell";
import { StepActions } from "./step-actions";

const e164 = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : raw.trim().startsWith("+") && d.length >= 8 ? `+${d}` : "";
};

// Step 1: who you are, whether this is for you or a business, and your
// mobile number, checked with a texted code.
export function AboutStep({ ctx }: { ctx: SetupContext }) {
  const saved = ctx.setup.answers.about;
  const [fullName, setFullName] = useState(saved?.fullName ?? ctx.profile.fullName);
  const [accountType, setAccountType] = useState<"personal" | "business">(saved?.accountType ?? ctx.profile.accountType);
  const [company, setCompany] = useState(saved?.company ?? ctx.profile.company);
  const [teamSize, setTeamSize] = useState(saved?.teamSize ?? "");
  const [industry, setIndustry] = useState(saved?.industry ?? "");
  const [website, setWebsite] = useState(saved?.website ?? "");
  const [phone, setPhone] = useState(saved?.phone ?? ctx.phones.find((p) => p.verified)?.number ?? ctx.profile.phone);
  const [verified, setVerified] = useState(() => new Set(ctx.phones.filter((p) => p.verified).map((p) => p.number)));
  const [check, setCheck] = useState<{ channelId: string; number: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const number = e164(phone);
  const isVerified = Boolean(number) && verified.has(number);
  const business = accountType === "business";

  const send = () => start(async () => {
    setMsg({});
    const res = await startPhoneCheck(phone);
    if (res.error) return setMsg({ error: res.error });
    if (res.verified) { setVerified(new Set([...verified, number])); setCheck(null); return setMsg({ ok: res.ok }); }
    if (res.channelId) setCheck({ channelId: res.channelId, number });
    setMsg({ ok: res.ok });
  });
  const confirm = () => check && start(async () => {
    const res = await confirmPhoneCheck(check.channelId, code);
    if (res.error) return setMsg({ error: res.error });
    setVerified(new Set([...verified, check.number])); setCheck(null); setCode(""); setMsg({ ok: "Your number is verified." });
  });

  const values = {
    fullName, accountType, phone: number, company: business ? company : undefined,
    teamSize: business && teamSize ? teamSize : undefined, industry: business && industry ? industry : undefined, website: business ? website : undefined,
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">A few details so your assistant knows who it&apos;s answering for.</p>

      <div className="space-y-1.5">
        <Label htmlFor="su-name">Your name</Label>
        <Input id="su-name" autoComplete="name" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Who is Redial for?</Label>
        <div role="radiogroup" aria-label="Who is Redial for" className="grid gap-2 sm:grid-cols-2">
          <Choice selected={!business} onSelect={() => setAccountType("personal")} title="Me" detail="My own cell, without the interruptions." />
          <Choice selected={business} onSelect={() => setAccountType("business")} title="My business" detail="Customers and leads call this number." />
        </div>
      </div>

      {business && (
        <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="su-company">Business name</Label>
            <Input id="su-company" autoComplete="organization" maxLength={120} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-team">Team size</Label>
            <select id="su-team" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm">
              <option value="">Choose…</option>
              {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-industry">Industry</Label>
            <select id="su-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm">
              <option value="">Choose…</option>
              {INDUSTRIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="su-web">Website <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="su-web" type="url" inputMode="url" placeholder="https://" maxLength={200} value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="su-phone">Your mobile number</Label>
        <p className="text-sm text-muted-foreground">The number people call you on today. We&apos;ll text you a code to make sure it&apos;s yours.</p>
        <div className="flex flex-wrap gap-2">
          <PhoneInput id="su-phone" className="max-w-xs" placeholder="(480) 555-0142" value={phone} onChange={(v) => { setPhone(v); setMsg({}); }} />
          {isVerified
            ? <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" /> Verified</span>
            : <Button variant="outline" disabled={pending || !number} onClick={send}>{check?.number === number ? "Send a new code" : "Text me a code"}</Button>}
        </div>
        {check && check.number === number && !isVerified && (
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="su-code">6-digit code</Label>
              <Input id="su-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="w-32 tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
            <Button disabled={pending || code.length !== 6} onClick={confirm}>Verify</Button>
          </div>
        )}
        {(msg.ok || msg.error) && <p role="status" className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}
        <p className="text-xs text-muted-foreground">Msg &amp; data rates may apply. Reply STOP to opt out.</p>
      </div>

      <StepActions step={1} values={values} disabled={!isVerified || fullName.trim().length < 2 || (business && !company.trim())} />
    </div>
  );
}
