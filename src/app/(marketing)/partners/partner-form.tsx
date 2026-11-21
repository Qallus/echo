"use client";

import { track } from "@/components/analytics/site-analytics";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowRight, Briefcase, Building2, Check, CheckCircle2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitPartner } from "./actions";
import { GROUPS, type Field, type Group } from "./programs";

// Pick a group (Partners, Careers, Reseller program), then a program; the
// form changes to match. Each request lands in Admin → Communications → Inbox
// and in the CRM, tagged by program.

const ICONS: Record<Group["id"], React.ComponentType<{ className?: string }>> = { partners: Handshake, careers: Briefcase, resellers: Building2 };
const CONSENT = "Redial may call, text or email me about this request. Message and data rates may apply. Reply STOP to opt out of texts.";

function Wrap({ id, label, required, children, className }: { id: string; label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function Chips({ name, label, options }: { name: string; label: string; options: string[] }) {
  const [on, setOn] = useState<string[]>([]);
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const picked = on.includes(o);
          return (
            <button key={o} type="button" aria-pressed={picked} onClick={() => setOn((xs) => (picked ? xs.filter((x) => x !== o) : [...xs, o]))}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", picked ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
              {picked && <Check className="size-3.5" />}{o}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={on.join(", ")} />
    </fieldset>
  );
}

function FieldInput({ f }: { f: Field }) {
  const id = `p-${f.name}`;
  if (f.kind === "chips") return <Chips name={f.name} label={f.label} options={f.options} />;
  if (f.kind === "pick") return (
    <Wrap id={id} label={f.label} className={f.wide ? "sm:col-span-2" : undefined}>
      <Pick id={id} name={f.name} label={f.label} defaultValue={f.options[0]} options={f.options.map((o) => ({ value: o, label: o }))} />
    </Wrap>
  );
  return (
    <Wrap id={id} label={f.label} required={f.required} className={f.wide ? "sm:col-span-2" : undefined}>
      <Input id={id} name={f.name} required={f.required} placeholder={f.placeholder} maxLength={f.name === "website" ? 300 : 200} />
    </Wrap>
  );
}

export function PartnerForm({ initialGroup, initialProgram }: { initialGroup: Group["id"]; initialProgram?: string }) {
  const [groupId, setGroupId] = useState<Group["id"]>(initialGroup);
  const group = GROUPS.find((g) => g.id === groupId)!;
  const [programId, setProgramId] = useState(group.programs.find((p) => p.id === initialProgram)?.id ?? group.programs[0].id);
  const program = group.programs.find((p) => p.id === programId) ?? group.programs[0];
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const syncUrl = (g: string, p: string) => {
    try { const u = new URL(window.location.href); u.searchParams.set("type", g); u.searchParams.set("program", p); window.history.replaceState(null, "", u); } catch {}
  };
  const chooseGroup = (g: Group) => { setGroupId(g.id); setProgramId(g.programs[0].id); setError(undefined); syncUrl(g.id, g.programs[0].id); };
  const chooseProgram = (id: string) => { setProgramId(id); setError(undefined); syncUrl(groupId, id); };

  const submit = (form: HTMLFormElement) => {
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const answers: Record<string, string> = {};
    const lines: string[] = [`Program: ${group.label}: ${program.label}`];
    for (const field of program.fields) {
      const v = f[field.name]?.trim();
      if (v) { answers[field.name] = v; lines.push(`${field.label.replace(/\. Pick any\.$/, "").replace(/\?$/, "")}: ${v}`); }
    }
    if (f.location?.trim()) lines.push(`Location: ${f.location.trim()}`);
    lines.push(`OK to call or text: ${consent ? "Yes" : "No"}`, "", f.message ?? "");
    start(async () => {
      const res = await submitPartner({
        program: program.id, name: f.name, email: f.email, phone: f.phone, company: f.company, website: f.website, location: f.location,
        message: lines.join("\n"), answers, consent, consentText: CONSENT, honeypot: f.homepage,
      });
      if (res.error) setError(res.error); else { setSent(true); track(`partners_${group.id}`.replace(/-/g, "_")); }
    });
  };

  const Icon = ICONS[group.id];
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Which fits you? <span className="text-sm font-normal text-muted-foreground">The form below changes to match.</span></h2>
      <div role="radiogroup" aria-label="Program group" className="grid gap-3 sm:grid-cols-3">
        {GROUPS.map((g, i) => {
          const on = g.id === groupId;
          const GIcon = ICONS[g.id];
          return (
            <button key={g.id} type="button" role="radio" aria-checked={on} onClick={() => chooseGroup(g)}
              className={cn("relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all", on ? "border-foreground bg-muted/60 shadow-sm ring-1 ring-foreground" : "hover:border-foreground/40 hover:bg-muted/30")}>
              <span className="flex items-center gap-2">
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", on ? "bg-foreground text-background" : "bg-muted")}>{i + 1}</span>
                <GIcon className="size-5" />
              </span>
              <span className={cn("absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border", on && "border-foreground bg-foreground text-background")}>{on && <Check className="size-3" />}</span>
              <span className="text-base font-semibold">{g.label}</span>
              <span className="text-xs text-muted-foreground">{g.desc}</span>
              <span className="mt-auto pt-1 text-xs font-medium">{on ? <span className="inline-flex items-center gap-1">Selected <ArrowDown className="size-3" /></span> : <span className="inline-flex items-center gap-1 text-muted-foreground">Choose this <ArrowRight className="size-3" /></span>}</span>
            </button>
          );
        })}
      </div>

      {sent ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-10 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-lg font-medium">Thanks, we got your request.</p>
          <p className="text-sm text-muted-foreground">Someone from our team will reply by email within one business day.</p>
          <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
        </div>
      ) : (
        <form id="form" key={program.id} className="scroll-mt-24 space-y-5 rounded-2xl border p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <div className="flex items-start gap-3 border-b pb-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="size-5" /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{group.label}</p>
              <h3 className="text-xl font-semibold tracking-tight">{group.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{group.intro}</p>
            </div>
          </div>

          {group.programs.length > 1 && (
            <div role="radiogroup" aria-label={`${group.label} program`} className="grid gap-2 sm:grid-cols-2">
              {group.programs.map((p) => {
                const on = p.id === program.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => chooseProgram(p.id)}
                    className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-foreground bg-muted/60" : "hover:bg-muted/40")}>
                    <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on && "border-foreground bg-foreground text-background")}>{on && <Check className="size-2.5" />}</span>
                    <span><span className="block text-sm font-semibold">{p.label}</span><span className="block text-xs text-muted-foreground">{p.desc}</span></span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Wrap id="p-name" label="Name" required><Input id="p-name" name="name" required autoComplete="name" maxLength={200} /></Wrap>
            <Wrap id="p-email" label="Email" required><Input id="p-email" name="email" type="email" required autoComplete="email" maxLength={200} /></Wrap>
            <Wrap id="p-phone" label="Phone"><PhoneInput id="p-phone" name="phone" /></Wrap>
            <Wrap id="p-location" label="City and state"><Input id="p-location" name="location" placeholder="e.g. Phoenix, AZ" maxLength={100} /></Wrap>
            {program.fields.map((f) => <FieldInput key={f.name} f={f} />)}
          </div>

          <Wrap id="p-msg" label="Anything else we should know?">
            <Textarea id="p-msg" name="message" rows={4} maxLength={8000}
              placeholder={group.id === "careers" ? "What draws you to Redial?" : group.id === "resellers" ? "Your programs today, the clients you serve, and what a great partnership looks like." : "Tell us about your audience or customers."} />
          </Wrap>

          <label htmlFor="p-consent" className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-sm">
            <Checkbox id="p-consent" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} className="mt-0.5" />
            <span className="text-muted-foreground">{CONSENT} Optional.</span>
          </label>

          {/* Left empty by people; bots fill it in. */}
          <input type="text" name="homepage" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : `Apply: ${program.label}`}</Button>
        </form>
      )}
    </div>
  );
}
