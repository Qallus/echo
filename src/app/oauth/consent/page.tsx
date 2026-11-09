import { AudioLines, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Allow access · Echo" };

// Plain-language labels for the OIDC scopes Supabase issues.
const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "See your email address",
  profile: "See your name and profile picture",
  phone: "See your phone number",
};

function host(uri: string) {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

// Supabase's OAuth 2.1 server sends the user here with ?authorization_id=...
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: id } = await searchParams;
  if (!id) return <Shell><Problem text="This page needs an authorization request. Start the connection again from the app you're connecting." /></Shell>;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${encodeURIComponent(id)}`)}`);

  // The connection's tokens carry this sign-in's two-step level, so staff
  // finish two-step first; otherwise their admin tools wouldn't appear.
  const staff = await getStaff();
  if (staff && !staff.mfaVerified) redirect(`/admin/mfa?next=${encodeURIComponent(`/oauth/consent?authorization_id=${encodeURIComponent(id)}`)}`);

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <Shell><Problem text="This request has expired or was already used. Start the connection again from the app you're connecting." /></Shell>;
  // Already approved for these scopes: send the user straight back.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const scopes = data.scope.split(" ").filter(Boolean);
  const name = data.client.name || "An unnamed app";

  return (
    <Shell>
      <div className="space-y-2 text-center">
        <h1 className="text-lg font-semibold">Allow {name} to access Echo?</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{data.user.email}</span>
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <p>
          <span className="font-medium">{name}</span> will be able to read, create, change and delete your Echo
          recordings, folders, action items and backlog, with the same access you have.
        </p>
        {scopes.length > 0 && (
          <ul className="space-y-1.5">
            {scopes.map((s) => (
              <li key={s} className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" /> {SCOPE_LABELS[s] ?? s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {data.client.uri && (<><dt className="text-muted-foreground">Website</dt><dd className="truncate">{host(data.client.uri)}</dd></>)}
        <dt className="text-muted-foreground">Returns to</dt>
        <dd className="break-all">{data.redirect_uri}</dd>
      </dl>

      <form action="/oauth/decision" method="post" className="grid grid-cols-2 gap-3">
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <Button type="submit" name="decision" value="deny" variant="outline">Deny</Button>
        <Button type="submit" name="decision" value="approve">Allow</Button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Only allow apps you trust. You can disconnect it later.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <AudioLines className="size-5" />
          <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return <p className="text-center text-sm text-muted-foreground">{text}</p>;
}
