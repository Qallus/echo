import Link from "next/link";
import { Briefcase, Lock } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StaffManager, type StaffMember } from "./staff-manager";
import { UsersTable, type UserRow } from "./users-table";

export const metadata = { title: "User Management · Admin · Echo" };

type WorkspaceRow = {
  workspace_id: string; name: string; is_personal: boolean; owner_email: string | null; members: number; recordings: number; created_at: string;
};

// Users (search, filters, invite; each opens a Customer 360), workspaces and,
// for owners, staff.
export default async function AdminUsersPage() {
  const staff = await requireStaff("users.view");
  const me = await requireUser();
  const supabase = await createClient();
  const showWorkspaces = can(staff, "workspaces.view");
  const showStaff = can(staff, "staff.manage");
  const [users, workspaces, staffList] = await Promise.all([
    supabase.rpc("admin_list_users"),
    showWorkspaces ? supabase.rpc("admin_list_workspaces") : Promise.resolve({ data: [], error: null }),
    showStaff ? supabase.rpc("admin_list_staff") : Promise.resolve({ data: [], error: null }),
  ]);
  if (users.error) throw new Error(users.error.message);
  const u = users.data as UserRow[];
  const w = (workspaces.data ?? []) as WorkspaceRow[];

  return (
    <AdminPage title="User Management" description={`${u.length} users · ${w.filter((x) => !x.is_personal).length} business workspaces`}>
      <Tabs defaultValue="users">
        <TabsList variant="line">
          <TabsTrigger value="users">Users</TabsTrigger>
          {showWorkspaces && <TabsTrigger value="workspaces">Workspaces</TabsTrigger>}
          {showStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
        </TabsList>

        <TabsContent value="users" className="pt-6">
          <UsersTable users={u} canInvite={can(staff, "users.manage")} />
        </TabsContent>

        {showWorkspaces && (
          <TabsContent value="workspaces" className="pt-6">
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
                        <Link href={`/admin/workspaces/${x.workspace_id}`} className={x.is_personal ? "text-muted-foreground hover:underline" : "font-medium hover:underline"}>{x.is_personal ? "Personal" : x.name}</Link>
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
          </TabsContent>
        )}

        {showStaff && (
          <TabsContent value="staff" className="pt-6">
            <StaffManager staff={(staffList.data ?? []) as StaffMember[]} meId={me.id} />
          </TabsContent>
        )}
      </Tabs>
    </AdminPage>
  );
}
