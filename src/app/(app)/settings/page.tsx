import Link from "next/link";
import { Briefcase, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSuperAdmin, listWorkspaces, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EmailForm, NameForm, PasswordForm, SignOutEverywhereButton } from "./settings-forms";

export const metadata = { title: "Settings · Echo" };

const PROVIDERS: Record<string, string> = { email: "Email (password or sign-in link)", google: "Google" };

export default async function SettingsPage() {
  await requireUser();
  const supabase = await createClient();
  const [{ data: { user } }, workspaces, superAdmin] = await Promise.all([supabase.auth.getUser(), listWorkspaces(), isSuperAdmin()]);
  if (!user) return null;
  const business = workspaces.filter((w) => !w.isPersonal);
  const accountType = superAdmin ? "Super Admin" : business.some((w) => w.role === "owner") ? "Business" : business.length ? "Team" : "Personal";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Account <Badge variant="outline">{accountType}</Badge></CardTitle>
          <CardDescription>What you can reach in Echo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Lock className="size-4" /> Personal workspace <span className="text-muted-foreground">· only you</span></li>
            {business.map((w) => (
              <li key={w.id} className="flex items-center gap-2">
                <Briefcase className="size-4" /> {w.name} <span className="capitalize text-muted-foreground">· {w.role}</span>
              </li>
            ))}
            {superAdmin && (
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Super Admin <Link href="/admin" className="text-muted-foreground underline">Open admin</Link>
              </li>
            )}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Manage business workspaces and your team on the <Link href="/team" className="underline">Team</Link> page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Name</CardTitle></CardHeader>
        <CardContent><NameForm fullName={(user.user_metadata?.full_name as string | undefined) ?? ""} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Email</CardTitle></CardHeader>
        <CardContent><EmailForm email={user.email ?? ""} pending={user.new_email ?? null} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Set or change the password you sign in with. If you&apos;ve only used sign-in links, this adds one.</CardDescription>
        </CardHeader>
        <CardContent><PasswordForm /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sign-in methods</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(user.identities ?? []).map((i) => (
              <li key={i.identity_id}>{PROVIDERS[i.provider] ?? i.provider}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Signs you out on every browser and device, including this one.</CardDescription>
        </CardHeader>
        <CardContent><SignOutEverywhereButton /></CardContent>
      </Card>
    </div>
  );
}
