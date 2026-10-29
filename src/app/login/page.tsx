import { AudioLines } from "lucide-react";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Echo" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <AudioLines className="size-5" />
            <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to your recordings</p>
        </div>
        <LoginForm next={safeNext(next)} initialError={error ? "That sign-in link didn't work. Try again." : undefined} />
      </div>
    </div>
  );
}
