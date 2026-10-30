import { notFound } from "next/navigation";
import { Briefcase, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalDate } from "@/components/local-date";
import { isSuperAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin · Echo" };

type UserRow = {
  user_id: string; email: string; full_name: string | null; created_at: string; last_sign_in_at: string | null;
  confirmed: boolean; account_type: "personal" | "business" | "team" | "super_admin"; workspaces: number; recordings: number;
};
type WorkspaceRow = {
  workspace_id: string; name: string; is_personal: boolean; owner_email: string | null; members: number; recordings: number; created_at: string;
};

const TYPE_LABEL = { personal: "Personal", business: "Business", team: "Team", super_admin: "Super Admin" };

// Super Admins only (everyone else gets a 404). Read-only; the database
// functions check the role again.
export default async function AdminPage() {
  if (!(await isSuperAdmin())) notFound();
  const supabase = await createClient();
  const [users, workspaces] = await Promise.all([supabase.rpc("admin_list_users"), supabase.rpc("admin_list_workspaces")]);
  if (users.error || workspaces.error) throw new Error(users.error?.message ?? workspaces.error?.message);
  const u = users.data as UserRow[];
  const w = workspaces.data as WorkspaceRow[];
  const counts = { users: u.length, business: w.filter((x) => !x.is_personal).length, recordings: w.reduce((n, x) => n + Number(x.recordings), 0) };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="size-4" /> Super Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          {counts.users} users · {counts.business} business workspaces · {counts.recordings} recordings
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Users</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Workspaces</TableHead>
              <TableHead className="text-right">Recordings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {u.map((x) => (
              <TableRow key={x.user_id}>
                <TableCell>
                  <div className="font-medium">{x.full_name || x.email}</div>
                  {x.full_name && <div className="text-xs text-muted-foreground">{x.email}</div>}
                  {!x.confirmed && <Badge variant="outline" className="mt-1">Unconfirmed</Badge>}
                </TableCell>
                <TableCell><Badge variant={x.account_type === "super_admin" ? "default" : "outline"}>{TYPE_LABEL[x.account_type]}</Badge></TableCell>
                <TableCell className="text-right">{x.workspaces}</TableCell>
                <TableCell className="text-right">{x.recordings}</TableCell>
                <TableCell className="text-muted-foreground"><LocalDate iso={x.created_at} short /></TableCell>
                <TableCell className="text-muted-foreground">{x.last_sign_in_at ? <LocalDate iso={x.last_sign_in_at} short /> : "Never"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Workspaces</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Recordings</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {w.map((x) => (
              <TableRow key={x.workspace_id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {x.is_personal ? <Lock className="size-3.5 text-muted-foreground" /> : <Briefcase className="size-3.5" />}
                    <span className={x.is_personal ? "text-muted-foreground" : "font-medium"}>{x.is_personal ? "Personal" : x.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{x.owner_email ?? "—"}</TableCell>
                <TableCell className="text-right">{x.members}</TableCell>
                <TableCell className="text-right">{x.recordings}</TableCell>
                <TableCell className="text-muted-foreground"><LocalDate iso={x.created_at} short /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
