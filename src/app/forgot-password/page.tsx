"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmail } from "@/app/login/login-form";
import { requestPasswordReset, type LoginState } from "@/app/login/actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestPasswordReset, {});
  return (
    <AuthShell
      title="Reset your password"
      subtitle={state.sent ? undefined : "We'll email you a link to choose a new one."}
      footer={<Link href="/login" className="font-medium text-foreground hover:underline">Back to sign in</Link>}
    >
      {state.sent ? (
        <CheckEmail email={state.sent} what="a password reset link (if there's an account for that email)" />
      ) : (
        <form action={action} className="space-y-3">
          <Input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      )}
    </AuthShell>
  );
}
