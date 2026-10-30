import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { isSuperAdmin, listFolders, listRecordings, listWorkspaces, requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [workspaces, recordings, folders, superAdmin] = await Promise.all([listWorkspaces(), listRecordings(), listFolders(), isSuperAdmin()]);

  return (
    <SidebarProvider>
      <AppSidebar email={user.email} workspaces={workspaces} recordings={recordings} folders={folders} superAdmin={superAdmin} />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-3 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
