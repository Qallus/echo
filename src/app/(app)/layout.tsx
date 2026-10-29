import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getWorkspace, listFolders, listRecordings, requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [workspace, recordings, folders] = await Promise.all([getWorkspace(), listRecordings(), listFolders()]);

  return (
    <SidebarProvider>
      <AppSidebar email={user.email} workspace={workspace} recordings={recordings} folders={folders} />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-3 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
