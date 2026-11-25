import { WorkspaceNav } from "@/components/admin/workspace/workspace-nav";
import { crmGuard as requireStaff } from "@/lib/crm/scope";
import { listWorkspaceDocs } from "@/lib/workspace/data";

// Workspace: shared pages with a page tree beside them.
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("crm.view");
  const docs = await listWorkspaceDocs();
  return (
    <div className="grid w-full gap-6 py-6 sm:py-8 lg:grid-cols-[240px_minmax(0,1fr)] px-4 sm:px-6 lg:px-8 2xl:px-10">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto print:hidden">
        <WorkspaceNav docs={docs} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
