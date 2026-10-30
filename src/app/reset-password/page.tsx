"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell } from "@/components/auth/auth-shell";
import { setNewPassword, type LoginState } from "@/app/login/actions";
import { MIN_PASSWORD } from "@/lib/auth-rules";

// Reached from the reset email: the link signs the user in, then lands here.
export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(setNewPassword, {});
  return (
    <AuthShell title="Choose a new password">
      <form action={action} className="space-y-3">
        <PasswordInput name="password" placeholder={`New password (at least ${MIN_PASSWORD} characters)`}
          autoComplete="new-password" minLength={MIN_PASSWORD} required />
        <PasswordInput name="confirm" placeholder="Repeat new password" autoComplete="new-password" required />
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </form>
    </AuthShell>
  );
}
