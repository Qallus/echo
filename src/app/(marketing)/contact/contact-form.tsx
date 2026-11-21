"use client";

import { track } from "@/components/analytics/site-analytics";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowRight, Bot, Building2, Check, CheckCircle2, House } from "lucide-react";
import { AgentIcon } from "@/components/marketing/agent-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitContact } from "./actions";
import { CONTACT_TYPES, type ContactType } from "./types";

// The contact form: pick one of four request types and the form changes to
// match. Everything lands in Admin → Communications → Inbox, with the type as
// the topic and the extra answers at the top of the message.


const TYPES: Record<ContactType, { label: string; title: string; desc: string; heading: string; intro: string; icon: React.ComponentType<{ className?: string }> }> = {
  residential: { label: "Residential", title: "Home and family", desc: "Redial on your home phone, scam protection, keeping your number.", heading: "Tell us about your home phone", intro: "A few details help the right person answer. Only the starred fields are required.", icon: House },
  business: { label: "Business", title: "My business", desc: "An AI receptionist, a business phone system, desk phones.", heading: "Tell us about your business", intro: "We'll come back with the right setup and pricing for your team.", icon: Building2 },
  "ai-agents": { label: "AI Agents", title: "AI Agents", desc: "AI that answers, books, follows up or makes calls for you.", heading: "Tell us what the AI should do", intro: "Describe the calls and tasks, and we'll show you how Redial can handle them.", icon: Bot },
  "live-agents": { label: "Live Agents", title: "Live Agents", desc: "Hire real people for your calls, or join as a Live Agent.", heading: "Hire Live Agents or join as one", intro: "Tell us which, and we'll point you to the right next step.", icon: AgentIcon },
};

const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
const RES_NEEDS = ["Set up Redial on my home phone", "Protect a parent or family member", "Keep my current number", "Help with my account", "Billing", "Something else"];
const RES_WHO = ["Me", "A parent or grandparent", "Another family member", "Someone I care for"];
const BIZ_NEEDS = ["An AI receptionist", "A business phone system", "Desk phones", "Keep my business numbers", "Pricing for my team", "Help with my account", "Something else"];
const BIZ_SIZE = ["Just me", "2–5", "6–20", "21–50", "51–200", "200+"];
const BIZ_INDUSTRY = ["Contractors and trades", "Home services", "Real estate", "Clinics and practices", "Law offices", "Salons and studios", "Restaurants and retail", "Agencies and consultants", "Other"];
const AI_TASKS = ["Answer calls", "Book appointments", "Qualify leads", "Customer support", "Follow-up texts and emails", "Outbound calls", "Connect to my CRM or calendar", "Build on the API or MCP"];
const AI_VOLUME = ["Under 100 calls a month", "100–1,000", "1,000–10,000", "10,000+", "Not sure yet"];
const LA_COVERAGE = ["On-demand, by the minute", "Scheduled shifts", "A monthly plan", "Not sure yet"];
const LA_WHEN = ["Overflow when we're busy", "After hours", "Lunch and breaks", "Weekends", "Launch days and events", "Bilingual calls"];
const LANGS = ["English", "Spanish", "Mandarin", "French", "Vietnamese", "Other"];

function Field({ id, label, required, children, className }: { id: string; label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

// Tick several; sent as one comma-separated answer.
function Chips({ name, label, options }: { name: string; label: string; options: string[] }) {
  const [on, setOn] = useState<string[]>([]);
  return (
    <fieldset className="space-y-2">
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

// The extra questions for each type. Field names become lines in the message.
const LABELS: Record<string, string> = {
  need: "Needs", who: "For", provider: "Current phone company", size: "Team size", industry: "Industry", lines: "Phone lines",
  tasks: "AI should", volume: "Call volume", tools: "Tools", path: "Looking to", coverage: "Coverage", when: "When", languages: "Languages",
  location: "Location", experience: "Experience",
};

function TypeFields({ type }: { type: ContactType }) {
  const [path, setPath] = useState<"hire" | "join">("hire");
  if (type === "residential") return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="c-need" label="What do you need?"><Pick id="c-need" name="need" label="What do you need?" defaultValue={RES_NEEDS[0]} options={opts(RES_NEEDS)} /></Field>
      <Field id="c-who" label="Who is it for?"><Pick id="c-who" name="who" label="Who is it for?" defaultValue={RES_WHO[0]} options={opts(RES_WHO)} /></Field>
      <Field id="c-provider" label="Current phone company" className="sm:col-span-2"><Input id="c-provider" name="provider" placeholder="e.g. Cox, AT&T, Verizon" maxLength={100} /></Field>
    </div>
  );
  if (type === "business") return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="c-company" label="Business name" required><Input id="c-company" name="company" required autoComplete="organization" maxLength={200} /></Field>
      <Field id="c-industry" label="Industry"><Pick id="c-industry" name="industry" label="Industry" defaultValue={BIZ_INDUSTRY[0]} options={opts(BIZ_INDUSTRY)} /></Field>
      <Field id="c-size" label="Team size"><Pick id="c-size" name="size" label="Team size" defaultValue={BIZ_SIZE[1]} options={opts(BIZ_SIZE)} /></Field>
      <Field id="c-lines" label="How many phone lines?"><Input id="c-lines" name="lines" inputMode="numeric" placeholder="e.g. 3" maxLength={20} /></Field>
      <Field id="c-need" label="What do you need?" className="sm:col-span-2"><Pick id="c-need" name="need" label="What do you need?" defaultValue={BIZ_NEEDS[0]} options={opts(BIZ_NEEDS)} /></Field>
    </div>
  );
  if (type === "ai-agents") return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-company" label="Business name"><Input id="c-company" name="company" autoComplete="organization" maxLength={200} /></Field>
        <Field id="c-volume" label="How many calls?"><Pick id="c-volume" name="volume" label="How many calls?" defaultValue={AI_VOLUME[0]} options={opts(AI_VOLUME)} /></Field>
      </div>
      <Chips name="tasks" label="What should the AI do? Pick any." options={AI_TASKS} />
      <Field id="c-tools" label="Tools you use (optional)"><Input id="c-tools" name="tools" placeholder="e.g. HubSpot, Google Calendar, ServiceTitan" maxLength={200} /></Field>
    </div>
  );
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Are you hiring or joining?" className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1">
        {([["hire", "I want to hire Live Agents"], ["join", "I want to become a Live Agent"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={path === v} onClick={() => setPath(v)}
            className={cn("rounded-lg px-3 py-2 text-sm transition-colors", path === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      <input type="hidden" name="path" value={path === "hire" ? "Hire Live Agents" : "Become a Live Agent"} />
      {path === "hire" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-company" label="Business name" required><Input id="c-company" name="company" required autoComplete="organization" maxLength={200} /></Field>
            <Field id="c-coverage" label="Coverage"><Pick id="c-coverage" name="coverage" label="Coverage" defaultValue={LA_COVERAGE[0]} options={opts(LA_COVERAGE)} /></Field>
          </div>
          <Chips name="when" label="When do you need people? Pick any." options={LA_WHEN} />
          <Chips name="languages" label="Languages" options={LANGS} />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-location" label="City and state" required><Input id="c-location" name="location" required placeholder="e.g. Tucson, AZ" maxLength={100} /></Field>
            <Field id="c-experience" label="Years answering phones"><Input id="c-experience" name="experience" inputMode="numeric" placeholder="e.g. 4" maxLength={20} /></Field>
          </div>
          <Chips name="languages" label="Languages you speak" options={LANGS} />
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Ready now? <a href="/signup?type=live_agent" className="font-medium text-foreground underline underline-offset-2">Create your Live Agent account</a> and set up your profile in about 15 minutes.
          </p>
        </>
      )}
    </div>
  );
}

export function ContactForm({ initial = "residential" }: { initial?: ContactType }) {
  const [type, setType] = useState<ContactType>(initial);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const t = TYPES[type];

  const choose = (next: ContactType) => {
    setType(next);
    setError(undefined);
    try { const u = new URL(window.location.href); u.searchParams.set("type", next); window.history.replaceState(null, "", u); } catch {}
  };

  const submit = (form: HTMLFormElement) => {
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const lines = Object.entries(LABELS).filter(([k]) => f[k]?.trim()).map(([k, l]) => `${l}: ${f[k].trim()}`);
    const message = [`Request: ${t.label}`, ...lines, "", f.message ?? ""].join("\n");
    start(async () => {
      const res = await submitContact({ name: f.name, email: f.email, phone: f.phone, company: f.company ?? "", topic: t.label, message, website: f.website });
      if (res.error) setError(res.error); else { setSent(true); track("contact"); }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">How can we help? <span className="text-sm font-normal text-muted-foreground">Choose one of 4 options. The form below changes to match.</span></h2>
      </div>
      <div role="radiogroup" aria-label="What's this about?" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CONTACT_TYPES.map((id, i) => {
          const o = TYPES[id];
          const on = id === type;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => choose(id)}
              className={cn("relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all", on ? "border-foreground bg-muted/60 shadow-sm ring-1 ring-foreground" : "hover:border-foreground/40 hover:bg-muted/30")}>
              <span className="flex items-center gap-2">
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", on ? "bg-foreground text-background" : "bg-muted")}>{i + 1}</span>
                <o.icon className="size-5" />
              </span>
              <span className={cn("absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border", on && "border-foreground bg-foreground text-background")}>{on && <Check className="size-3" />}</span>
              <span className="text-base font-semibold">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.desc}</span>
              <span className="mt-auto pt-1 text-xs font-medium">{on ? <span className="inline-flex items-center gap-1">Selected <ArrowDown className="size-3" /></span> : <span className="inline-flex items-center gap-1 text-muted-foreground">Choose this <ArrowRight className="size-3" /></span>}</span>
            </button>
          );
        })}
      </div>

      {sent ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-10 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-lg font-medium">Thanks, we got your message.</p>
          <p className="text-sm text-muted-foreground">A real person will reply by email within one business day.</p>
          <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
        </div>
      ) : (
        <form id="form" key={type} className="scroll-mt-24 space-y-5 rounded-2xl border p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <div className="flex items-start gap-3 border-b pb-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><t.icon className="size-5" /></span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{t.title}</p>
              <h3 className="text-xl font-semibold tracking-tight">{t.heading}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-name" label="Name" required><Input id="c-name" name="name" required autoComplete="name" maxLength={200} /></Field>
            <Field id="c-email" label="Email" required><Input id="c-email" name="email" type="email" required autoComplete="email" maxLength={200} /></Field>
            <Field id="c-phone" label="Phone" className="sm:col-span-2"><PhoneInput id="c-phone" name="phone" /></Field>
          </div>
          <TypeFields type={type} />
          <Field id="c-msg" label="Message" required>
            <Textarea id="c-msg" name="message" required rows={5} maxLength={8000}
              placeholder={type === "ai-agents" ? "What happens on a typical call, and what should happen next?" : type === "business" ? "Anything we should know: your hours, how calls reach you today, what's not working…" : "How can we help?"} />
          </Field>
          {/* Left empty by people; bots fill it in. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : `Send ${t.label} request`}</Button>
        </form>
      )}
    </div>
  );
}
