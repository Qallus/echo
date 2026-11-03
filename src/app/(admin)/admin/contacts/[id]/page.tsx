import { notFound } from "next/navigation";
import { ContactRecord } from "@/components/admin/crm/contact-record";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, getContact, listActivities, listCompanies, listDeals } from "@/lib/crm/data";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contact · Admin · Echo" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("crm.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const contact = await getContact(id);
  if (!contact) notFound();
  const supabase = await createClient();
  const [deals, companies, people, echoUserId] = await Promise.all([
    listDeals({ contactId: id }), listCompanies(), crmStaff(),
    contact.email && can(staff, "users.view") ? supabase.rpc("admin_user_by_email", { p_email: contact.email }).then((r) => r.data as string | null) : null,
  ]);
  const activities = await listActivities({ contactIds: [id], dealIds: deals.map((d) => d.id) });
  return (
    <ContactRecord contact={contact} companies={companies.map(({ id, name }) => ({ id, name }))} deals={deals} activities={activities}
      staff={people} echoUserId={echoUserId} readOnly={!can(staff, "crm.manage")} />
  );
}
