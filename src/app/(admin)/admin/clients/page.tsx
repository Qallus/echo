import { AdminPage } from "@/components/admin/admin-ui";
import { ClientsList, type ClientRow } from "@/components/admin/crm/clients-list";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies, listContacts, listDeals } from "@/lib/crm/data";
import { OPEN_STAGES } from "@/lib/crm/types";

export const metadata = { title: "Clients · Admin · Echo" };

// Companies Qallus sells to or works with, with contact and pipeline totals.
export default async function ClientsPage() {
  const staff = await requireStaff("crm.view");
  const [companies, contacts, deals, people] = await Promise.all([listCompanies(), listContacts(), listDeals(), crmStaff()]);
  const rows: ClientRow[] = companies.map((c) => {
    const mine = deals.filter((d) => d.company_id === c.id);
    const open = mine.filter((d) => OPEN_STAGES.includes(d.stage));
    return {
      ...c,
      contacts: contacts.filter((x) => x.company_id === c.id).length,
      open_deals: open.length,
      open_value: open.reduce((n, d) => n + d.value_cents, 0),
      won_value: mine.filter((d) => d.stage === "closed_won").reduce((n, d) => n + d.value_cents, 0),
    };
  });
  return (
    <AdminPage title="Clients" description="Companies Qallus sells to or works with.">
      <ClientsList clients={rows} staff={people} readOnly={!can(staff, "crm.manage")} />
    </AdminPage>
  );
}
