import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleAuthEnabled } from "@/lib/auth-providers";
import { safeNext } from "@/lib/safe-next";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Redial" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; type?: string }> }) {
  const sp = await searchParams;
  // New accounts go to Redial setup (Live Agents: their profile builder)
  // unless they came from somewhere specific.
  const type = sp.type === "business" ? "business" : sp.type === "live_agent" ? "live_agent" : "personal";
  const next = sp.next ? safeNext(sp.next) : type === "live_agent" ? "/agent-desk/setup" : "/setup";
  return (
    <AuthShell
      title={type === "live_agent" ? "Join Redial as a Live Agent" : "Create your Redial account"}
      footer={<>Already have an account? <Link href={`/login${sp.next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground hover:underline">Sign in</Link></>}
    >
      <SignupForm next={next} initialType={type} google={await googleAuthEnabled()} />
    </AuthShell>
  );
}
