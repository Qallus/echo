"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, ExternalLink, LogOut, ShieldCheck, UserPlus } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser, restoreUser, signOutUserEverywhere, suspendUser } from "@/lib/admin/actions/users";
import { roleLabel, type StaffRole } from "@/lib/admin/permissions";

export type UserRow = {
  user_id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string; last_sign_in_at: string | null;
  confirmed: boolean; account_type: "personal" | "business" | "team"; workspaces: number; recordings: number;
  staff_role: StaffRole | null; suspended: boolean; subscription_status: string | null;
};

const TYPE_LABEL = { personal: "Personal", business: "Business", team: "Team" };
const inactive = (u: UserRow) => !u.last_sign_in_at || Date.now() - Date.parse(u.last_sign_in_at) > 30 * 86400_000;
const paying = (u: UserRow) => u.subscription_status === "active" || u.subscription_status === "trialing";

function Badges({ u }: { u: UserRow }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant="outline">{TYPE_LABEL[u.account_type]}</Badge>
      {u.staff_role && <Badge>{roleLabel(u.staff_role)}</Badge>}
      {u.subscription_status && <Badge variant="outline" className={u.subscription_status === "past_due" ? "text-destructive" : ""}>{u.subscription_status.replace("_", " ")}</Badge>}
      {u.suspended && <Badge variant="destructive">Suspended</Badge>}
      {!u.confirmed && <Badge variant="outline">Unconfirmed</Badge>}
    </span>
  );
}

// Every user in the shared list layout; each opens a preview with a link to
// their Customer 360. Staff with users.manage can invite, suspend, restore
// and sign people out.
export function UsersTable({ users, canInvite }: { users: UserRow[]; canInvite: boolean }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const manage = canInvite;
  const name = (u: UserRow) => u.full_name || u.email;
  const avatar = (u: UserRow) => <UserAvatar name={u.full_name} email={u.email} src={u.avatar_url} size="md" />;

  // One action across many users; stops at the first error.
  const each = (rows: UserRow[], fn: (u: UserRow) => Promise<{ ok?: string; error?: string }>, done: string) => start(async () => {
    for (const u of rows) {
      const r = await fn(u);
      if (r.error) { setMsg({ error: `${name(u)}: ${r.error}` }); router.refresh(); return; }
    }
    setMsg({ ok: done });
    router.refresh();
  });
  const suspend = (rows: UserRow[]) => {
    const reason = prompt(`Suspend ${rows.length === 1 ? name(rows[0]) : `${rows.length} users`}? They're signed out and can't sign in until restored. Reason (kept in the audit log):`, "");
    if (reason !== null) each(rows, (u) => suspendUser(u.user_id, reason), rows.length === 1 ? "Suspended." : `Suspended ${rows.length}.`);
  };
  const restore = (rows: UserRow[]) => each(rows, (u) => restoreUser(u.user_id), rows.length === 1 ? "Restored." : `Restored ${rows.length}.`);
  const signOut = (rows: UserRow[]) => confirm(`Sign ${rows.length === 1 ? name(rows[0]) : `${rows.length} users`} out on every device?`)
    && each(rows, (u) => signOutUserEverywhere(u.user_id), "Signed out on every device.");

  return (
    <div className="space-y-4">
      {inviting && (
        <form className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
          onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await inviteUser(email); setMsg(res); if (res.ok) setEmail(""); }); }}>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="max-w-xs" aria-label="Email to invite" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</Button>
          <span className="text-xs text-muted-foreground">They get an email to set a password and join Redial.</span>
        </form>
      )}
      {(msg.error || msg.ok) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}

      <CollectionView<UserRow>
        items={users} getId={(u) => u.user_id} title={name} noun={["user", "users"]} storageKey="admin-users" defaultView="table"
        subtitle={(u) => (u.full_name ? u.email : TYPE_LABEL[u.account_type])}
        media={avatar}
        badge={(u) => (u.suspended ? <Badge variant="destructive">Suspended</Badge> : u.staff_role ? <Badge>{roleLabel(u.staff_role)}</Badge> : null)}
        meta={(u) => <>{u.recordings} recordings · {u.workspaces} workspaces · last sign-in {u.last_sign_in_at ? <LocalDate iso={u.last_sign_in_at} short /> : "never"}</>}
        searchText={(u) => `${u.full_name ?? ""} ${u.email} ${TYPE_LABEL[u.account_type]} ${u.staff_role ?? ""} ${u.subscription_status ?? ""}`}
        filters={[
          { id: "all", label: "All", test: () => true },
          { id: "personal", label: "Personal", test: (u) => u.account_type === "personal" },
          { id: "business", label: "Business", test: (u) => u.account_type === "business" },
          { id: "team", label: "Team", test: (u) => u.account_type === "team" },
          { id: "staff", label: "Staff", test: (u) => Boolean(u.staff_role) },
          { id: "paying", label: "Paying", test: paying },
          { id: "suspended", label: "Suspended", test: (u) => u.suspended },
          { id: "unconfirmed", label: "Unconfirmed", test: (u) => !u.confirmed },
          { id: "inactive", label: "Inactive 30 days", test: inactive },
        ]}
        date={(u) => u.created_at}
        columns={[
          { id: "user", label: "User", sort: (u) => name(u).toLowerCase(), cell: (u) => (
            <span className="flex items-center gap-2.5">{avatar(u)}<span className="min-w-0"><span className="block truncate font-medium">{name(u)}</span>{u.full_name && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}</span></span>
          ) },
          { id: "status", label: "Status", sort: (u) => `${u.suspended ? 0 : 1}${u.account_type}`, cell: (u) => <Badges u={u} /> },
          { id: "recordings", label: "Recordings", sort: (u) => u.recordings, cell: (u) => <span className="tabular-nums">{u.recordings}</span> },
          { id: "workspaces", label: "Workspaces", sort: (u) => u.workspaces, cell: (u) => <span className="tabular-nums">{u.workspaces}</span> },
          { id: "joined", label: "Joined", sort: (u) => u.created_at, cell: (u) => <span className="text-muted-foreground"><LocalDate iso={u.created_at} short /></span> },
          { id: "last", label: "Last sign-in", sort: (u) => u.last_sign_in_at, cell: (u) => <span className="text-muted-foreground">{u.last_sign_in_at ? <LocalDate iso={u.last_sign_in_at} short /> : "Never"}</span> },
        ]}
        toolbar={manage && <Button variant="outline" onClick={() => setInviting((v) => !v)}><UserPlus /> Invite user</Button>}
        actions={[
          { label: "Open", icon: ExternalLink, single: true, run: ([u]) => router.push(`/admin/users/${u.user_id}`) },
          ...(manage ? [
            { label: "Sign out everywhere", icon: LogOut, run: signOut },
            { label: "Restore", icon: ShieldCheck, show: (rows: UserRow[]) => rows.some((u) => u.suspended), run: (rows: UserRow[]) => restore(rows.filter((u) => u.suspended)) },
            { label: "Suspend", icon: Ban, destructive: true, show: (rows: UserRow[]) => rows.some((u) => !u.suspended), run: (rows: UserRow[]) => suspend(rows.filter((u) => !u.suspended)) },
          ] : []),
        ]}
        previewActions={(u) => <Button size="sm" nativeButton={false} render={<Link href={`/admin/users/${u.user_id}`} />}><ExternalLink /> Customer 360</Button>}
        preview={(u) => (
          <div className="space-y-4 text-sm">
            <Badges u={u} />
            <dl className="divide-y rounded-xl border px-3">
              {([
                ["Email", u.email], ["Account", TYPE_LABEL[u.account_type]], ["Plan", u.subscription_status?.replace("_", " ") ?? "Free"],
                ["Recordings", String(u.recordings)], ["Workspaces", String(u.workspaces)],
                ["Joined", <LocalDate key="j" iso={u.created_at} />], ["Last sign-in", u.last_sign_in_at ? <LocalDate key="l" iso={u.last_sign_in_at} /> : "Never"],
                ["Email confirmed", u.confirmed ? "Yes" : "Not yet"],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
              ))}
            </dl>
            {manage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => signOut([u])}><LogOut /> Sign out everywhere</Button>
                {u.suspended
                  ? <Button size="sm" variant="outline" disabled={pending} onClick={() => restore([u])}><ShieldCheck /> Restore</Button>
                  : <Button size="sm" variant="destructive" disabled={pending} onClick={() => suspend([u])}><Ban /> Suspend</Button>}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
