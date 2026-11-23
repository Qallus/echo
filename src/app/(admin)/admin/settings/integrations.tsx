"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AudioLines, CheckCircle2, CircleDashed, Cloud, Copy, CreditCard, KeyRound, LayoutGrid, MessagesSquare, PlugZap, Share2, Sparkles, Webhook, X } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { clearIntegrationKey, generateCronSecret, saveIntegration, testIntegration } from "@/lib/admin/actions/integrations";
import { SERVICES, type Service } from "@/lib/integrations";
import { cn } from "@/lib/utils";

export type KeyState = { hint: string | null; source: "dashboard" | "coolify" | null; updated_at: string | null };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function ServiceCard({ service, state, readOnly }: { service: Service; state: Record<string, KeyState>; readOnly: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [generated, setGenerated] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); setMsg(r); if (!r.error) after?.(); });
  const connected = service.fields.filter((f) => f.required).every((f) => state[f.key]?.source);
  const anySet = service.fields.some((f) => state[f.key]?.source);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-medium">{service.name}
            {connected ? <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-3" /> Set up</Badge>
              : <Badge variant="outline" className="gap-1 text-muted-foreground"><CircleDashed className="size-3" /> {anySet ? "Incomplete" : "Not set"}</Badge>}
          </h3>
          <p className="text-sm text-muted-foreground">{service.description}</p>
        </div>
        {service.testable && <Button size="sm" variant="outline" disabled={pending || !anySet} onClick={() => run(() => testIntegration(service.id))}><PlugZap /> Test</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {service.fields.map((f) => {
          const s = state[f.key];
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`int-${f.key}`} className="flex flex-wrap items-center gap-1.5">
                {f.label}{f.required && <span className="text-xs text-muted-foreground">(required)</span>}
              </Label>
              <div className="flex items-center gap-1.5">
                {f.secret
                  ? <PasswordInput id={`int-${f.key}`} value={values[f.key] ?? ""} disabled={readOnly} autoComplete="off" onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      placeholder={s?.source === "dashboard" ? `${s.hint} (saved; type to replace)` : s?.source === "coolify" ? "Using Coolify's value (type to override)" : f.placeholder ?? ""} />
                  : <Input id={`int-${f.key}`} value={values[f.key] ?? ""} disabled={readOnly} autoComplete="off" onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      placeholder={s?.source === "dashboard" ? s.hint ?? "" : s?.source === "coolify" ? "Using Coolify's value (type to override)" : f.placeholder ?? ""} />}
                {!readOnly && s?.source === "dashboard" && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Clear ${f.label}`} disabled={pending}
                    onClick={() => confirm(`Clear the saved ${f.label}?`) && run(() => clearIntegrationKey(f.key))}><X /></Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {s?.source === "dashboard" ? `Saved here${s.updated_at ? ` ${when(s.updated_at)}` : ""}` : s?.source === "coolify" ? "From Coolify" : "Not set"}
                <span className="ml-1.5 font-mono opacity-60">{f.key}</span>
              </p>
            </div>
          );
        })}
      </div>

      {generated && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Copy this into the Coolify scheduled task now. It won&apos;t be shown again.</p>
          <div className="flex gap-2"><code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{generated}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(generated)}><Copy /> Copy</Button></div>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending || !Object.values(values).some((v) => v.trim())} onClick={() => run(() => saveIntegration(service.id, values), () => setValues({}))}>
            <KeyRound /> {pending ? "Saving…" : "Save"}
          </Button>
          {service.id === "cron" && <Button size="sm" variant="outline" disabled={pending}
            onClick={() => confirm("Generate a new cron secret? The old one stops working until you update the Coolify scheduled task.") && start(async () => {
              const r = await generateCronSecret(); setMsg(r); if (r.value) setGenerated(r.value);
            })}>Generate new secret</Button>}
          <span className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</span>
        </div>
      )}
    </section>
  );
}

type Group = { id: string; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; ids: string[] };

// Categories in the rail. Gemini is an AI provider, so it sits with AI, not Google.
const GROUPS: Group[] = [
  { id: "communications", title: "Communications", desc: "Phone, texts and email.", icon: MessagesSquare, ids: ["twilio", "resend"] },
  { id: "payments", title: "Payments", desc: "Checkout, subscriptions and refunds.", icon: CreditCard, ids: ["stripe"] },
  { id: "ai", title: "AI providers", desc: "Redial's own keys for transcription, summaries and Ask Echo.", icon: Sparkles, ids: ["openai", "anthropic", "xai", "gemini", "openrouter", "moonshot"] },
  { id: "google", title: "Google", desc: "Connect Google for customers, Redial's own Workspace, and Maps for prospecting.", icon: Cloud, ids: ["google_calendar", "google_workspace", "google_maps"] },
  { id: "microsoft", title: "Microsoft", desc: "Connect Outlook, OneDrive and Teams.", icon: LayoutGrid, ids: ["microsoft_calendar"] },
  { id: "social", title: "Social media", desc: "Posting to LinkedIn, Facebook and Instagram.", icon: Share2, ids: ["linkedin", "meta"] },
  { id: "redial", title: "Redial", desc: "The voice gateway, the mobile app and scheduled jobs.", icon: AudioLines, ids: ["redial", "mobile", "cron"] },
  { id: "automation", title: "Automation and other", desc: "Webhook signing and anything else.", icon: Webhook, ids: ["automation"] },
];
// Any service not placed above still shows, under Automation and other.
const ALL_GROUPS = (): Group[] => {
  const placed = new Set(GROUPS.flatMap((g) => g.ids));
  const rest = SERVICES.filter((s) => !placed.has(s.id)).map((s) => s.id);
  return GROUPS.map((g) => (g.id === "automation" ? { ...g, ids: [...g.ids, ...rest] } : g));
};

const isSet = (s: Service, state: Record<string, KeyState>) => s.fields.filter((f) => f.required).every((f) => state[f.key]?.source);

// Credentials for every service Redial uses, one category at a time. A value
// saved here replaces the Coolify variable of the same name; clear it to fall
// back to Coolify. While this is open, the main sidebar folds to icons so the
// category rail has room (and opens again when you leave).
export function Integrations({ state, readOnly, initialGroup }: { state: Record<string, KeyState>; readOnly: boolean; initialGroup?: string }) {
  const groups = ALL_GROUPS();
  const [active, setActive] = useState(groups.some((x) => x.id === initialGroup) ? initialGroup! : groups[0].id);
  const group = groups.find((g) => g.id === active) ?? groups[0];
  const { open, setOpen, isMobile } = useSidebar();
  const folded = useRef(false);

  useEffect(() => {
    if (isMobile || !open || folded.current) return;
    folded.current = true;
    setOpen(false);
  }, [isMobile, open, setOpen]);
  useEffect(() => () => { if (folded.current) setOpen(true); }, [setOpen]);

  const choose = (id: string) => {
    setActive(id);
    try { const u = new URL(window.location.href); u.searchParams.set("tab", "integrations"); u.searchParams.set("group", id); window.history.replaceState(null, "", u); } catch {}
  };

  return (
    <div className="grid gap-6 md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <nav aria-label="Integration categories" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:sticky md:top-20 md:mx-0 md:flex-col md:self-start md:overflow-visible md:border-r md:px-0 md:pr-3">
        {groups.map((g) => {
          const services = g.ids.map((id) => SERVICES.find((x) => x.id === id)!).filter(Boolean);
          const done = services.filter((s) => isSet(s, state)).length;
          const on = g.id === group.id;
          return (
            <button key={g.id} type="button" onClick={() => choose(g.id)} aria-current={on ? "page" : undefined}
              className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
              <g.icon className="size-4 shrink-0" />
              <span className="flex-1 whitespace-nowrap">{g.title}</span>
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums",
                done === services.length ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : done ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                {done}/{services.length}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><group.icon className="size-5" />{group.title}</h2>
          <p className="text-sm text-muted-foreground">{group.desc}</p>
        </div>
        {group.ids.map((id) => { const s = SERVICES.find((x) => x.id === id); return s ? <ServiceCard key={id} service={s} state={state} readOnly={readOnly} /> : null; })}
        <p className="max-w-3xl pt-2 text-xs text-muted-foreground">
          Keys are encrypted before they&apos;re stored and never shown again; only owners and admins can change them, and every change is in the audit log.
          A value saved here is used instead of the Coolify variable with the same name, within a minute and without a redeploy.
        </p>
      </div>
    </div>
  );
}
