"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleButton } from "@/components/auth/google-button";
import { resendConfirmation, sendMagicLink, signInWithPassword, type LoginState } from "./actions";

// Password sign-in by default; "Email me a sign-in link" switches to a magic link.
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(signInWithPassword, { error: initialError });
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [resent, setResent] = useState<LoginState>();
  const [resending, startResend] = useTransition();

  if (linkState.sent) return <CheckEmail email={linkState.sent} what="a sign-in link" />;

  return (
    <div className="space-y-4">
      <GoogleButton next={next} />

      {mode === "password" ? (
        <form action={pwAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
          <PasswordInput name="password" placeholder="Password" autoComplete="current-password" required />
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full" disabled={pwPending}>{pwPending ? "Signing in…" : "Sign in"}</Button>
        </form>
      ) : (
        <form action={linkAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <Input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
          <Button type="submit" className="w-full" disabled={linkPending}>{linkPending ? "Sending…" : "Email me a sign-in link"}</Button>
        </form>
      )}

      {mode === "password" && pwState.error && <p className="text-sm text-destructive">{pwState.error}</p>}
      {mode === "link" && linkState.error && <p className="text-sm text-destructive">{linkState.error}</p>}
      {mode === "password" && pwState.unconfirmed && (
        resent?.sent
          ? <p className="text-sm text-muted-foreground">We sent a new confirmation link to {resent.sent}.</p>
          : <Button variant="link" className="h-auto p-0 text-sm" disabled={resending}
              onClick={() => startResend(async () => setResent(await resendConfirmation(pwState.unconfirmed!)))}>
              Resend the confirmation email
            </Button>
      )}

      <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setMode(mode === "password" ? "link" : "password")}>
        {mode === "password" ? "Email me a sign-in link instead" : "Sign in with a password instead"}
      </button>
    </div>
  );
}

export function CheckEmail({ email, what }: { email: string; what: string }) {
  return (
    <div className="space-y-3 text-center">
      <MailCheck className="mx-auto size-8" />
      <p className="font-medium">Check your email</p>
      <p className="text-sm text-muted-foreground">We sent {what} to {email}.</p>
    </div>
  );
}
