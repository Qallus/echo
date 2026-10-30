import { Briefcase, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CopyLink, CreateWorkspaceForm, InviteForm, RemoveMemberButton, RevokeInviteButton,
} from "@/components/team/team-forms";
import { LocalDate } from "@/components/local-date";
import { listInvites, listMembers, listWorkspaces, requireUser } from "@/lib/data";
import { siteOrigin } from "@/lib/site";

export const metadata = { title: "Team · Echo" };

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
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
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
        const owners = members.filter((m) => m.role === "owner").length;
        return (
          <Card key={ws.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase className="size-4" /> {ws.name}</CardTitle>
              <CardDescription>You&apos;re {ws.role === "admin" ? "an admin" : `the ${ws.role}`} · {members.length} {members.length === 1 ? "person" : "people"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="divide-y rounded-lg border">
                {members.map((m) => {
                  const self = m.userId === user.id;
                  const canRemove = self ? !(m.role === "owner" && owners === 1) : ws.role === "owner";
                  return (
                    <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.fullName || m.email}{self && " (you)"}</div>
                        {m.fullName && <div className="truncate text-xs text-muted-foreground">{m.email}</div>}
                      </div>
                      <Badge variant="outline" className="capitalize">{m.role}</Badge>
                      {canRemove && <RemoveMemberButton workspaceId={ws.id} userId={m.userId} self={self} />}
                    </li>
                  );
                })}
              </ul>

              {ws.role !== "member" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Invite people</h3>
                  <InviteForm workspaceId={ws.id} />
                  {invites.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                      {invites.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{i.email}</div>
                            <div className="text-xs text-muted-foreground">
                              Pending · <span className="capitalize">{i.role}</span> · expires <LocalDate iso={i.expiresAt} short />
                            </div>
                          </div>
                          <CopyLink link={`${origin}/invite/${i.token}`} />
                          <RevokeInviteButton id={i.id} />
                        </li>
                      ))}
                    </ul>
                  )}
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
