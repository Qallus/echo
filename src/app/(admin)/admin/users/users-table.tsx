"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { LayoutGrid, Rows3, Search, UserPlus } from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inviteUser } from "@/lib/admin/actions/users";
import { roleLabel, type StaffRole } from "@/lib/admin/permissions";
import { cn } from "@/lib/utils";

export type UserRow = {
  user_id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string; last_sign_in_at: string | null;
  confirmed: boolean; account_type: "personal" | "business" | "team"; workspaces: number; recordings: number;
  staff_role: StaffRole | null; suspended: boolean; subscription_status: string | null;
};

const TYPE_LABEL = { personal: "Personal", business: "Business", team: "Team" };
const FILTERS = ["All", "Personal", "Business", "Team", "Staff", "Paying", "Suspended", "Unconfirmed", "Inactive 30d"] as const;
type Filter = (typeof FILTERS)[number];
const SELECT = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function matches(u: UserRow, f: Filter) {
  switch (f) {
    case "All": return true;
    case "Staff": return Boolean(u.staff_role);
    case "Paying": return u.subscription_status === "active" || u.subscription_status === "trialing";
    case "Suspended": return u.suspended;
    case "Unconfirmed": return !u.confirmed;
    case "Inactive 30d": return !u.last_sign_in_at || Date.now() - Date.parse(u.last_sign_in_at) > 30 * 86400_000;
    default: return TYPE_LABEL[u.account_type] === f;
  }
}

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

// Searchable, filterable user list; each user opens their Customer 360.
export function UsersTable({ users, canInvite }: { users: UserRow[]; canInvite: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [view, setView] = useState<"table" | "cards">("table");
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => matches(u, filter) && (!q || `${u.full_name ?? ""} ${u.email}`.toLowerCase().includes(q)));
  }, [users, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="pl-8" aria-label="Search users" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={SELECT} aria-label="Filter">
          {FILTERS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <div className="flex rounded-lg border p-0.5">
          <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" aria-label="Table view" onClick={() => setView("table")}><Rows3 /></Button>
          <Button variant={view === "cards" ? "secondary" : "ghost"} size="icon-sm" aria-label="Card view" onClick={() => setView("cards")}><LayoutGrid /></Button>
        </div>
        <span className="text-sm text-muted-foreground">{shown.length} of {users.length}</span>
        {canInvite && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setInviting((v) => !v)}><UserPlus /> Invite user</Button>}
      </div>

      {inviting && (
        <form className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
          onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await inviteUser(email); setMsg(res); if (res.ok) setEmail(""); }); }}>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="max-w-xs" aria-label="Email to invite" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</Button>
          <span className="text-xs text-muted-foreground">They get an email to set a password and join Echo.</span>
          {msg.error && <p className="w-full text-sm text-destructive">{msg.error}</p>}
          {msg.ok && <p className="w-full text-sm text-muted-foreground">{msg.ok}</p>}
        </form>
      )}

      {shown.length === 0 ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No users match.</p> : view === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recordings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((u) => (
              <TableRow key={u.user_id} className={cn(u.suspended && "opacity-60")}>
                <TableCell>
                  <Link href={`/admin/users/${u.user_id}`} className="flex items-center gap-2.5 hover:underline">
                    <UserAvatar name={u.full_name} email={u.email} src={u.avatar_url} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.full_name || u.email}</span>
                      {u.full_name && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
                    </span>
                  </Link>
                </TableCell>
                <TableCell><Badges u={u} /></TableCell>
                <TableCell className="text-right tabular-nums">{u.recordings}</TableCell>
                <TableCell className="text-muted-foreground"><LocalDate iso={u.created_at} short /></TableCell>
                <TableCell className="text-muted-foreground">{u.last_sign_in_at ? <LocalDate iso={u.last_sign_in_at} short /> : "Never"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((u) => (
            <Link key={u.user_id} href={`/admin/users/${u.user_id}`} className={cn("space-y-3 rounded-xl border p-4 hover:bg-muted/40", u.suspended && "opacity-60")}>
              <span className="flex items-center gap-3">
                <UserAvatar name={u.full_name} email={u.email} src={u.avatar_url} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{u.full_name || u.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
              </span>
              <Badges u={u} />
              <span className="block text-xs text-muted-foreground">{u.recordings} recordings · {u.workspaces} workspaces</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
