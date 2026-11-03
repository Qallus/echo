import { AdminPage } from "@/components/admin/admin-ui";
import { ContactsPage } from "@/components/admin/crm/contacts-page";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies, listContacts } from "@/lib/crm/data";

export const metadata = { title: "Contacts · Admin · Echo" };

// Everyone Qallus works with: leads, prospects, clients and partners.
export default async function Contacts() {
  const staff = await requireStaff("crm.view");
  const [contacts, companies, people] = await Promise.all([listContacts(), listCompanies(), crmStaff()]);
  return (
    <AdminPage title="Contacts" description="Everyone Qallus works with, from first lead to paying client. Internal; customers never see this." className="max-w-[96rem]">
      <ContactsPage contacts={contacts} companies={companies.map(({ id, name }) => ({ id, name }))} staff={people} readOnly={!can(staff, "crm.manage")} />
    </AdminPage>
  );
}
