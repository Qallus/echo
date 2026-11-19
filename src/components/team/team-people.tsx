"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, LogOut, MailX, UserMinus } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { ProfileHoverCard } from "@/components/profile/profile-card";
import { UserAvatar } from "@/components/profile/user-avatar";
import { CopyLink, RemoveMemberButton, RevokeInviteButton } from "@/components/team/team-forms";
import { Badge } from "@/components/ui/badge";
import { removeMember, revokeInvite } from "@/lib/actions";
import type { Invite, Member } from "@/lib/data";
import type { WorkspaceRole } from "@/lib/types";

// One business workspace's people and pending invites in the shared list layout.
// Who can remove whom is the same as before: owners remove anyone, everyone can
// leave, except the last owner. Admins and owners see and revoke invites.

type Row =
  | { kind: "member"; id: string; member: Member; self: boolean; canRemove: boolean }
  | { kind: "invite"; id: string; invite: Invite; link: string };

const name = (r: Row) => (r.kind === "member" ? r.member.fullName || r.member.email : r.invite.email);
const role = (r: Row) => (r.kind === "member" ? r.member.role : r.invite.role);
const sub = (r: Row) => r.kind === "member"
  ? [r.member.jobTitle, r.member.company].filter(Boolean).join(" · ") || r.member.email
  : "Invite pending";

export function TeamPeople({ workspaceId, myRole, userId, members, invites, origin }: {
  workspaceId: string; myRole: WorkspaceRole; userId: string; members: Member[]; invites: Invite[]; origin: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const owners = members.filter((m) => m.role === "owner").length;
  const rows: Row[] = [
    ...members.map((m): Row => {
      const self = m.id === userId;
      return { kind: "member", id: m.id, member: m, self, canRemove: self ? !(m.role === "owner" && owners === 1) : myRole === "owner" };
    }),
    ...invites.map((i): Row => ({ kind: "invite", id: `invite:${i.id}`, invite: i, link: `${origin}/invite/${i.token}` })),
  ];

  const avatar = (r: Row) => r.kind === "member"
    ? <ProfileHoverCard person={r.member}><UserAvatar name={r.member.fullName} email={r.member.email} src={r.member.avatarUrl} size="md" /></ProfileHoverCard>
    : <UserAvatar name={null} email={r.invite.email} src={null} size="md" className="opacity-60" />;
  const roleBadge = (r: Row) => (
    <span className="flex items-center gap-1">
      <Badge variant="outline" className="capitalize">{role(r)}</Badge>
      {r.kind === "invite" && <Badge variant="secondary">Pending</Badge>}
    </span>
  );

  const run = (fn: () => Promise<string | undefined>) => start(async () => {
    const err = await fn();
    setError(err ?? null);
    router.refresh();
  });
  const removeRows = (rows: Row[]) => {
    const list = rows.filter((r): r is Extract<Row, { kind: "member" }> => r.kind === "member" && r.canRemove);
    if (!list.length) return;
    const leaving = list.some((r) => r.self);
    const msg = list.length === 1
      ? (leaving ? "Leave this workspace? You'll lose access to its recordings." : `Remove ${name(list[0])} from this workspace?`)
      : `Remove ${list.length} people from this workspace?${leaving ? " That includes you: you'll lose access to its recordings." : ""}`;
    if (!confirm(msg)) return;
    run(async () => {
      for (const r of list) { const res = await removeMember(workspaceId, r.member.id); if (res?.error) return res.error; }
    });
  };
  const revokeRows = (rows: Row[]) => {
    const list = rows.filter((r): r is Extract<Row, { kind: "invite" }> => r.kind === "invite");
    if (!list.length || !confirm(`Revoke ${list.length === 1 ? `the invite for ${list[0].invite.email}` : `${list.length} invites`}? The link stops working.`)) return;
    run(async () => { for (const r of list) await revokeInvite(r.invite.id); return undefined; });
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <CollectionView<Row>
        items={rows} getId={(r) => r.id} noun={["person", "people"]} storageKey="team-people" defaultView="list"
        title={(r) => `${name(r)}${r.kind === "member" && r.self ? " (you)" : ""}`}
        subtitle={sub} media={avatar} badge={roleBadge}
        meta={(r) => r.kind === "member" ? <>Joined <LocalDate iso={r.member.joinedAt} short /></> : <>Expires <LocalDate iso={r.invite.expiresAt} short /></>}
        searchText={(r) => r.kind === "member" ? [r.member.fullName, r.member.email, r.member.jobTitle, r.member.company, r.member.role].filter(Boolean).join(" ") : `${r.invite.email} ${r.invite.role}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "members", label: "Members", test: (r) => r.kind === "member" },
          { id: "admins", label: "Owners and admins", test: (r) => r.kind === "member" && r.member.role !== "member" },
          ...(invites.length ? [{ id: "invites", label: "Pending invites", test: (r: Row) => r.kind === "invite" }] : []),
        ]}
        date={(r) => (r.kind === "member" ? r.member.joinedAt : r.invite.expiresAt)}
        columns={[
          { id: "name", label: "Name", sort: (r) => name(r).toLowerCase(), cell: (r) => <span className="flex items-center gap-2.5">{avatar(r)}<span className="min-w-0"><span className="block truncate font-medium">{name(r)}{r.kind === "member" && r.self && " (you)"}</span><span className="block truncate text-xs text-muted-foreground">{sub(r)}</span></span></span> },
          { id: "email", label: "Email", sort: (r) => (r.kind === "member" ? r.member.email : r.invite.email), cell: (r) => <span className="text-muted-foreground">{r.kind === "member" ? r.member.email : r.invite.email}</span> },
          { id: "role", label: "Role", sort: role, cell: roleBadge },
          { id: "joined", label: "Joined", sort: (r) => (r.kind === "member" ? r.member.joinedAt : null), cell: (r) => <span className="text-muted-foreground">{r.kind === "member" ? <LocalDate iso={r.member.joinedAt} short /> : "—"}</span> },
        ]}
        actions={[
          { label: "Copy invite link", icon: Link2, single: true, show: ([r]) => r?.kind === "invite", run: ([r]) => { if (r.kind === "invite") void navigator.clipboard.writeText(r.link); } },
          { label: "Remove", icon: UserMinus, destructive: true, show: (rs) => rs.some((r) => r.kind === "member" && r.canRemove && !r.self), run: removeRows },
          { label: "Leave", icon: LogOut, destructive: true, single: true, show: ([r]) => r?.kind === "member" && r.self && r.canRemove, run: removeRows },
          { label: "Revoke invite", icon: MailX, destructive: true, show: (rs) => rs.some((r) => r.kind === "invite"), run: revokeRows },
        ]}
        previewActions={(r) => r.kind === "member"
          ? (r.canRemove ? <RemoveMemberButton workspaceId={workspaceId} userId={r.member.id} self={r.self} /> : null)
          : <><CopyLink link={r.link} /><RevokeInviteButton id={r.invite.id} /></>}
        preview={(r) => (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              {r.kind === "member"
                ? <UserAvatar name={r.member.fullName} email={r.member.email} src={r.member.avatarUrl} size="lg" />
                : <UserAvatar name={null} email={r.invite.email} src={null} size="lg" className="opacity-60" />}
              <div className="min-w-0"><p className="truncate font-medium">{name(r)}</p><p className="truncate text-muted-foreground">{sub(r)}</p></div>
            </div>
            <dl className="divide-y rounded-xl border px-3">
              {(r.kind === "member"
                ? [["Email", r.member.email], ["Role", <span key="r" className="capitalize">{r.member.role}</span>], ["Phone", r.member.phone], ["Location", r.member.location], ["Time zone", r.member.timezone], ["Joined", <LocalDate key="j" iso={r.member.joinedAt} />]]
                : [["Email", r.invite.email], ["Role", <span key="r" className="capitalize">{r.invite.role}</span>], ["Expires", <LocalDate key="e" iso={r.invite.expiresAt} />], ["Link", <span key="l" className="break-all text-xs">{r.link}</span>]]
              ).filter(([, v]) => v).map(([k, v]) => (
                <div key={String(k)} className="grid grid-cols-[6rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0">{v}</dd></div>
              ))}
            </dl>
            {r.kind === "member" && !r.canRemove && r.self && <p className="text-xs text-muted-foreground">You&apos;re the only owner, so you can&apos;t leave. Make someone else an owner first.</p>}
          </div>
        )}
      />
    </div>
  );
}
