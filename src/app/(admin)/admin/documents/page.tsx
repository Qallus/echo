import { AdminPage } from "@/components/admin/admin-ui";
import { DocumentsPanel } from "@/components/admin/documents/documents-panel";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies } from "@/lib/crm/data";
import { listDocuments, listFolders } from "@/lib/documents/data";

export const metadata = { title: "Documents · Admin · Echo" };

// Business files: contracts, proposals, brand assets, linked to clients.
export default async function Documents() {
  const staff = await requireStaff("crm.view");
  const [docs, folders, companies, people] = await Promise.all([listDocuments(), listFolders(), listCompanies(), crmStaff()]);
  return (
    <AdminPage title="Documents" description="Contracts, proposals and files. Drag files in to upload; share links expire after 7 days." className="max-w-[96rem]">
      <DocumentsPanel docs={docs} folders={folders} staff={people} companies={companies.map(({ id, name }) => ({ id, name }))}
        readOnly={!can(staff, "crm.manage") && !can(staff, "projects.manage")} />
    </AdminPage>
  );
}
