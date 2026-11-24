import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminMobileHeader } from "@/components/admin/admin-mobile-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Softphone } from "@/components/admin/comms/softphone";
import { TopBar } from "@/components/shell/shell";
import { can, getStaff } from "@/lib/admin/guard";
import { countUnreadNotifications, getMyProfile, requireUser } from "@/lib/data";

export const metadata = { title: "Admin · Redial" };

// The Super Admin area. Customers get a 404. Staff who haven't passed two-step
// sign-in this session see only the MFA page (every other page sends them there).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) notFound();
  if (!staff.mfaVerified) return <main className="min-h-svh bg-background">{children}</main>;
  const [user, profile, unread] = await Promise.all([requireUser(), getMyProfile(), countUnreadNotifications()]);
  const me = { id: user.id, name: profile.fullName, email: user.email ?? "", avatarUrl: profile.avatarUrl, unread };

  return (
    <SidebarProvider defaultOpen={(await cookies()).get("sidebar_state")?.value !== "false"}>
      <AdminSidebar me={me} permissions={staff.permissions} />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <AdminMobileHeader permissions={staff.permissions} />
        <TopBar me={me} mode="admin" canAdmin search={{ permissions: staff.permissions }} />
        {/* Phones: leave room for the fixed bottom bar. */}
        <main data-admin-main className="flex-1 pb-[var(--bottom-nav)] md:pb-0">{children}</main>
        <AdminBottomNav permissions={staff.permissions} />
        {can(staff, "comms.manage") && <Softphone />}
      </SidebarInset>
    </SidebarProvider>
  );
}
