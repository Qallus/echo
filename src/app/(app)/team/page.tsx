import { Briefcase, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateWorkspaceForm, InviteForm } from "@/components/team/team-forms";
import { TeamPeople } from "@/components/team/team-people";
import { listInvites, listMembers, listWorkspaces, requireUser } from "@/lib/data";
import { siteOrigin } from "@/lib/site";

export const metadata = { title: "Team · Redial" };

export default async function TeamPage() {
  const user = await requireUser();
  const business = (await listWorkspaces()).filter((w) => !w.isPersonal);
  const origin = await siteOrigin();
  const spaces = await Promise.all(
    business.map(async (ws) => ({
      ws,
      members: await listMembers(ws.id),
      invites: ws.role === "member" ? [] : await listInvites(ws.id),
    })),
  );

  return (
    <div className="w-full space-y-8 py-10 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Business &amp; team</h1>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <p className="flex gap-2"><Briefcase className="mt-0.5 size-4 shrink-0" />
            <span><span className="font-medium text-foreground">Business</span> recordings are shared with everyone in that workspace.</span></p>
          <p className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0" />
            <span><span className="font-medium text-foreground">Personal</span> recordings stay private to you. Move a recording between them from its page.</span></p>
        </div>
      </div>

      {spaces.map(({ ws, members, invites }) => {
        return (
          <Card key={ws.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase className="size-4" /> {ws.name}</CardTitle>
              <CardDescription>You&apos;re {ws.role === "admin" ? "an admin" : `the ${ws.role}`} · {members.length} {members.length === 1 ? "person" : "people"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <TeamPeople workspaceId={ws.id} myRole={ws.role} userId={user.id} members={members} invites={invites} origin={origin} />

              {ws.role !== "member" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Invite people</h3>
                  <InviteForm workspaceId={ws.id} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>{spaces.length ? "Create another business workspace" : "Create your business workspace"}</CardTitle>
          <CardDescription>
            You&apos;ll be its owner. Invite your team, then move or record calls into it so everyone can hear them.
          </CardDescription>
        </CardHeader>
        <CardContent><CreateWorkspaceForm first={!spaces.length} /></CardContent>
      </Card>
    </div>
  );
}
