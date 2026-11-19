import { AdminPage } from "@/components/admin/admin-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { StaffManager, type StaffMember } from "./staff-manager";
import { UsersTable, type UserRow } from "./users-table";
import { WorkspacesList, type WorkspaceRow } from "./workspaces-list";

export const metadata = { title: "User Management · Admin · Redial" };


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
            <WorkspacesList workspaces={w} />
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
