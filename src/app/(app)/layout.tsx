import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { RecorderProvider } from "@/components/recorder/recorder-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isSuperAdmin, listFolders, listRecordings, listWorkspaces, requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [workspaces, recordings, folders, superAdmin] = await Promise.all([listWorkspaces(), listRecordings(), listFolders(), isSuperAdmin()]);

  return (
    <RecorderProvider workspaces={workspaces} userId={user.id}>
    <SidebarProvider>
      <AppSidebar email={user.email} workspaces={workspaces} recordings={recordings} folders={folders} superAdmin={superAdmin} />
      {/* overflow-x-clip (not hidden): trims sub-pixel overflow without breaking the sticky header. */}
      <SidebarInset className="min-w-0 overflow-x-clip">
        <MobileHeader email={user.email} />
        {/* Phones: leave room for the fixed bottom bar (--bottom-nav in globals.css). */}
        <main className="flex-1 pb-[var(--bottom-nav)] md:pb-0">{children}</main>
        <BottomNav workspaces={workspaces} />
      </SidebarInset>
    </SidebarProvider>
    </RecorderProvider>
  );
}
