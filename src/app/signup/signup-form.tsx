"use client";

import { useActionState, useState } from "react";
import { Briefcase, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleButton } from "@/components/auth/google-button";
import { CheckEmail } from "@/app/login/login-form";
import { signUp, type LoginState } from "@/app/login/actions";
import { MIN_PASSWORD } from "@/lib/auth-rules";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "personal", icon: Lock, title: "Personal", desc: "Just me. Private recordings." },
  { value: "business", icon: Briefcase, title: "Business", desc: "My company and team." },
] as const;

export function SignupForm({ next, initialType = "personal" }: { next: string; initialType?: "personal" | "business" }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signUp, {});
  const [type, setType] = useState<"personal" | "business">(initialType);

  if (state.sent) return <CheckEmail email={state.sent} what="a link to confirm your account" />;

  return (
    <div className="space-y-4">
      <GoogleButton next={next} label="Sign up with Google" />
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="account_type" value={type} />
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Account type</legend>
          {TYPES.map(({ value, icon: Icon, title, desc }) => (
            <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}
              className={cn("flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                type === value && "border-primary ring-1 ring-primary")}>
              <Icon className="mb-1.5 size-4" />
              <div className="text-sm font-medium">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </button>
          ))}
        </fieldset>
        {type === "business" && (
          <Input name="company_name" placeholder="Company or team name" maxLength={120} required />
        )}
        <Input name="full_name" placeholder="Your name" autoComplete="name" maxLength={120} required />
        <Input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
        <PasswordInput name="password" placeholder={`Password (at least ${MIN_PASSWORD} characters)`}
          autoComplete="new-password" minLength={MIN_PASSWORD} required />
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </form>
      <p className="text-center text-xs text-muted-foreground">
        {type === "business"
          ? "You'll own the business workspace and can invite your team. You also get a private Personal space."
          : "Joining a team? Use the invite link you were sent instead."}
      </p>
    </div>
  );
}
