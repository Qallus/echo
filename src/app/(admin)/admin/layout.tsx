import { notFound } from "next/navigation";
import { AdminMobileHeader } from "@/components/admin/admin-mobile-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getStaff } from "@/lib/admin/guard";

export const metadata = { title: "Admin · Echo" };

// The Super Admin area. Customers get a 404. Staff who haven't passed two-step
// sign-in this session see only the MFA page (every other page sends them there).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) notFound();
  if (!staff.mfaVerified) return <main className="min-h-svh bg-background">{children}</main>;

  return (
    <SidebarProvider>
      <AdminSidebar role={staff.role} permissions={staff.permissions} />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <AdminMobileHeader />
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
