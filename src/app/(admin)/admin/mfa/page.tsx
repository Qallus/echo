import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getStaff } from "@/lib/admin/guard";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Two-step sign-in · Admin · Echo" };

export default async function MfaPage() {
  const staff = await getStaff();
  if (!staff) notFound();
  if (staff.mfaVerified) redirect("/admin");
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <ShieldCheck className="mx-auto size-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Two-step sign-in</h1>
        <p className="text-sm text-muted-foreground">The admin area needs a code from an authenticator app (Google Authenticator, 1Password, Authy…) every time you sign in.</p>
      </div>
      <MfaForm />
    </div>
  );
}
