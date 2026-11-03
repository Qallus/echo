import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { AdminMobileHeader } from "@/components/admin/admin-mobile-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin · Echo" };

// The Super Admin area. Customers get a 404. Staff who haven't passed two-step
// sign-in this session see only the MFA page (every other page sends them there).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) notFound();
  if (!staff.mfaVerified) return <main className="min-h-svh bg-background">{children}</main>;
  const { data: security } = await (await createClient()).from("platform_settings").select("value").eq("key", "admin_security").maybeSingle();
  const mfaOff = (security?.value as { requireMfa?: boolean } | null)?.requireMfa === false;

  return (
    <SidebarProvider defaultOpen={(await cookies()).get("sidebar_state")?.value !== "false"}>
      <AdminSidebar role={staff.role} permissions={staff.permissions} />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <AdminMobileHeader />
        {mfaOff && (
          <p className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-800 sm:px-6 dark:text-amber-200">
            <ShieldOff className="size-3.5 shrink-0" /> Two-step sign-in is off for staff.
            <Link href="/admin/settings" className="font-medium underline underline-offset-2">Turn it back on before launch</Link>
          </p>
        )}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
