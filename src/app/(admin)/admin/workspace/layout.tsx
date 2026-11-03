import { WorkspaceNav } from "@/components/admin/workspace/workspace-nav";
import { requireStaff } from "@/lib/admin/guard";
import { listWorkspaceDocs } from "@/lib/workspace/data";

// Workspace: shared pages with a page tree beside them.
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("crm.view");
  const docs = await listWorkspaceDocs();
  return (
    <div className="mx-auto grid w-full max-w-[96rem] gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto print:hidden">
        <WorkspaceNav docs={docs} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
