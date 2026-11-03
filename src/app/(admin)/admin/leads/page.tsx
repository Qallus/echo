import { AdminPage } from "@/components/admin/admin-ui";
import { LeadsPage } from "@/components/admin/crm/leads-page";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies, listContacts } from "@/lib/crm/data";

export const metadata = { title: "Leads · Admin · Echo" };

// Inquiries before they become opportunities.
export default async function Leads() {
  const staff = await requireStaff("crm.view");
  const [leads, companies, people] = await Promise.all([listContacts({ leads: true }), listCompanies(), crmStaff()]);
  return (
    <AdminPage title="Leads" description="New inquiries: work them through, then add them to the pipeline." className="max-w-[96rem]">
      <LeadsPage leads={leads} companies={companies.map(({ id, name }) => ({ id, name }))} staff={people} readOnly={!can(staff, "crm.manage")} />
    </AdminPage>
  );
}
