"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { googleSignInUrl, sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { error: initialError });
  const [googleError, setGoogleError] = useState<string>();
  const [googlePending, setGooglePending] = useState(false);

  const google = async () => {
    setGooglePending(true);
    const res = await googleSignInUrl(next);
    if (res.url) window.location.href = res.url;
    else { setGoogleError(res.error); setGooglePending(false); }
  };

  if (state.sent) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto size-8" />
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">We sent a sign-in link to {state.sent}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" className="w-full" onClick={google} disabled={googlePending}>
        <GoogleIcon /> Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <Input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</Button>
      </form>
      {(state.error || googleError) && <p className="text-sm text-destructive">{state.error || googleError}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
