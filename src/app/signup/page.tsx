import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNext } from "@/lib/safe-next";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Echo" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell
      title="Create your Echo account"
      footer={<>Already have an account? <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground hover:underline">Sign in</Link></>}
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
