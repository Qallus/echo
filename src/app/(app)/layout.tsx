import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { RecorderProvider } from "@/components/recorder/recorder-provider";
import { CatalogSync } from "@/components/store/catalog-sync";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { callsBadge } from "@/lib/redial/data";
import { lineNumber } from "@/lib/line/server";
import { countUnreadNotifications, getMyProfile, isSuperAdmin, isSuspended, listFolders, listRecordings, listWorkspaces, requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (await isSuspended()) redirect("/suspended");
  const [workspaces, recordings, folders, superAdmin, profile, unread, catalog, callsUnread, line] = await Promise.all([
    listWorkspaces(), listRecordings(), listFolders(), isSuperAdmin(), getMyProfile(), countUnreadNotifications(), loadCatalog(), callsBadge(), lineNumber(),
  ]);
  const me = { id: user.id, name: profile.fullName, email: user.email, avatarUrl: profile.avatarUrl, unread };

  return (
    <RecorderProvider workspaces={workspaces} userId={user.id}>
    <CatalogSync products={catalog} />
    <SidebarProvider defaultOpen={(await cookies()).get("sidebar_state")?.value !== "false"}>
      <AppSidebar me={me} workspaces={workspaces} recordings={recordings} folders={folders} superAdmin={superAdmin} callsUnread={callsUnread} phoneLine={Boolean(line)} />
      {/* overflow-x-clip (not hidden): trims sub-pixel overflow without breaking the sticky header. */}
      <SidebarInset className="min-w-0 overflow-x-clip">
        <MobileHeader me={me} />
        {/* Phones: leave room for the fixed bottom bar (--bottom-nav in globals.css). */}
        <main className="flex-1 pb-[var(--bottom-nav)] md:pb-0">{children}</main>
        <BottomNav workspaces={workspaces} />
      </SidebarInset>
    </SidebarProvider>
    </RecorderProvider>
  );
}
