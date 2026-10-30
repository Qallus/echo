"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { MIN_PASSWORD } from "@/lib/auth-rules";
import { changeEmail, changePassword, signOutEverywhere, updateName, type SettingsState } from "./actions";

function Status({ state }: { state: SettingsState }) {
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-muted-foreground">{state.ok}</p>;
  return null;
}

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateName, {});
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="full_name" defaultValue={fullName} placeholder="Your name" maxLength={120} required />
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function EmailForm({ email, pending: pendingEmail }: { email: string; pending: string | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changeEmail, {});
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm">Current: <span className="font-medium">{email}</span></p>
      {pendingEmail && <p className="text-sm text-muted-foreground">Waiting for you to confirm {pendingEmail}.</p>}
      <div className="flex gap-2">
        <Input name="email" type="email" placeholder="New email address" required />
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Sending…" : "Change"}</Button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <PasswordInput name="password" placeholder={`New password (${MIN_PASSWORD}+ characters)`}
          autoComplete="new-password" minLength={MIN_PASSWORD} required />
        <PasswordInput name="confirm" placeholder="Repeat new password" autoComplete="new-password" required />
      </div>
      {state.needCode && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">For your security we emailed you a verification code. Enter it to save.</p>
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={10} required />
        </div>
      )}
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
      <Status state={state} />
    </form>
  );
}

export function SignOutEverywhereButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(() => signOutEverywhere())}>
      {pending ? "Signing out…" : "Sign out of all devices"}
    </Button>
  );
}
