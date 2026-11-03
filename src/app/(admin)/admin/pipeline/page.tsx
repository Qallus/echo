import { AdminPage } from "@/components/admin/admin-ui";
import { PipelinePage } from "@/components/admin/crm/pipeline-page";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies, listContacts, listDeals } from "@/lib/crm/data";

export const metadata = { title: "Pipeline · Admin · Echo" };

// Qallus's sales pipeline for Echo: opportunities by stage, with a weighted forecast.
export default async function Pipeline() {
  const staff = await requireStaff("crm.view");
  const [deals, companies, contacts, people] = await Promise.all([listDeals(), listCompanies(), listContacts(), crmStaff()]);
  return (
    <AdminPage title="Pipeline" description="The lead-to-client sales lifecycle: opportunities by stage, with a weighted forecast." className="max-w-[96rem]">
      <PipelinePage deals={deals} companies={companies.map(({ id, name }) => ({ id, name }))} contacts={contacts} staff={people} readOnly={!can(staff, "crm.manage")} />
    </AdminPage>
  );
}
