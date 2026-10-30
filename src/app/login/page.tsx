import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Echo" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safe = safeNext(next);
  return (
    <AuthShell
      title="Sign in to Echo"
      subtitle="Your recordings, transcripts and summaries"
      footer={<>New to Echo? <Link href={`/signup${safe !== "/" ? `?next=${encodeURIComponent(safe)}` : ""}`} className="font-medium text-foreground hover:underline">Create an account</Link></>}
    >
      <LoginForm next={safe} initialError={error ? "That sign-in link didn't work. Try again." : undefined} />
    </AuthShell>
  );
}
