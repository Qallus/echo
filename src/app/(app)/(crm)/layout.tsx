import { listWorkspaces } from "@/lib/data";
import { crmScope, workspaceCrmReady } from "@/lib/crm/scope";
import { WorkspaceSwitch } from "./workspace-switch";

// Contacts, Leads, Prospects, Clients, Pipeline, Plans, Workspace docs and
// Business Cards for a Personal or Business workspace. The bar on top picks
// which workspace's records you're looking at.
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  if (!(await workspaceCrmReady())) return children;
  const [workspaces, scope] = await Promise.all([listWorkspaces(), crmScope()]);
  return (
    <>
      {workspaces.length > 1 && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8 2xl:px-10">
          <WorkspaceSwitch current={scope.workspaceId ?? ""} workspaces={workspaces.map((w) => ({ id: w.id, name: w.isPersonal ? "Personal" : w.name, personal: w.isPersonal }))} />
        </div>
      )}
      {children}
    </>
  );
}
