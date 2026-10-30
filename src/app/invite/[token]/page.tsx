import Link from "next/link";
import { AudioLines, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcceptInviteButton } from "@/components/team/team-forms";
import { isUuid, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Join workspace · Echo" };

type InviteInfo = {
  workspace_name: string; email: string; role: string; invited_by_email: string | null; expires_at: string; accepted: boolean;
};

// Opened from an invite link. Signed-out visitors are sent to /login and back.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser();

  let invite: InviteInfo | null = null;
  if (isUuid(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_workspace_invite", { invite_token: token });
    invite = (data as InviteInfo[] | null)?.[0] ?? null;
  }

  let body: React.ReactNode;
  if (!invite) body = <Note text="This invite link isn't valid. Ask for a new one." />;
  else if (invite.accepted) body = <Note text="This invite was already used." home />;
  else if (new Date(invite.expires_at) < new Date()) body = <Note text="This invite has expired. Ask for a new one." />;
  else if (invite.email !== user.email.toLowerCase())
    body = (
      <div className="space-y-4 text-center text-sm">
        <p>This invite is for <span className="font-medium">{invite.email}</span>, but you&apos;re signed in as{" "}
          <span className="font-medium">{user.email}</span>.</p>
        <form action="/auth/signout" method="post"><Button type="submit" variant="outline">Sign out and switch account</Button></form>
      </div>
    );
  else
    body = (
      <div className="space-y-5">
        <div className="space-y-2 text-center">
          <Briefcase className="mx-auto size-6" />
          <h1 className="text-lg font-semibold">Join {invite.workspace_name}</h1>
          <p className="text-sm text-muted-foreground">
            {invite.invited_by_email ?? "A teammate"} invited you as {invite.role === "admin" ? "an admin" : "a member"}.
            You&apos;ll be able to hear and work on this business workspace&apos;s recordings. Your Personal recordings stay private.
          </p>
        </div>
        <AcceptInviteButton token={token} />
      </div>
    );

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <AudioLines className="size-5" />
          <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
        </div>
        {body}
      </div>
    </div>
  );
}

function Note({ text, home }: { text: string; home?: boolean }) {
  return (
    <div className="space-y-4 text-center text-sm text-muted-foreground">
      <p>{text}</p>
      {home && <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Go to Echo</Button>}
    </div>
  );
}
