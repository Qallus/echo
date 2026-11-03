import { AdminPage } from "@/components/admin/admin-ui";
import { ContactsList } from "@/components/admin/crm/contacts-list";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies, listContacts } from "@/lib/crm/data";

export const metadata = { title: "Contacts · Admin · Echo" };

// Everyone Qallus works with: leads, customers, partners.
export default async function ContactsPage() {
  const staff = await requireStaff("crm.view");
  const [contacts, companies, people] = await Promise.all([listContacts(), listCompanies(), crmStaff()]);
  return (
    <AdminPage title="Contacts" description="Leads, customers and partners. Internal to Qallus; customers never see this.">
      <ContactsList contacts={contacts} companies={companies.map(({ id, name }) => ({ id, name }))} staff={people} readOnly={!can(staff, "crm.manage")} />
    </AdminPage>
  );
}
