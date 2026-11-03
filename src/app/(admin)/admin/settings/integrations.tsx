"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleDashed, Copy, KeyRound, PlugZap, X } from "lucide-react";
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

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Phone and email", ids: ["twilio", "resend"] },
  { title: "Payments", ids: ["stripe"] },
  { title: "AI providers (Echo's own keys)", ids: ["openai", "anthropic", "xai", "gemini", "openrouter", "moonshot"] },
  { title: "Social media", ids: ["linkedin", "meta"] },
  { title: "Scheduled jobs", ids: ["cron"] },
];

// Credentials for every service Echo uses. A value saved here replaces the
// Coolify variable of the same name; clear it to fall back to Coolify.
export function Integrations({ state, readOnly }: { state: Record<string, KeyState>; readOnly: boolean }) {
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Keys are encrypted before they&apos;re stored and never shown again; only owners and admins can change them, and every change is in the audit log.
        A value saved here is used instead of the Coolify variable with the same name, within a minute and without a redeploy.
      </p>
      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h2>
          {g.ids.map((id) => { const s = SERVICES.find((x) => x.id === id)!; return <ServiceCard key={id} service={s} state={state} readOnly={readOnly} />; })}
        </div>
      ))}
    </div>
  );
}
