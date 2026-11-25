import AdminLayout from "@/app/(admin)/admin/workspace/layout";
import { workspaceCrmReady } from "@/lib/crm/scope";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  if (!(await workspaceCrmReady())) return children;
  return <AdminLayout>{children}</AdminLayout>;
}
