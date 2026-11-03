import { notFound } from "next/navigation";
import { OpportunityWorkspace } from "@/components/admin/crm/opportunity-workspace";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, dealHistory, getContact, getDeal, getStageConfig, listActivities } from "@/lib/crm/data";
import { isUuid } from "@/lib/data";

export const metadata = { title: "Opportunity · Admin · Echo" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("crm.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const deal = await getDeal(id);
  if (!deal) notFound();
  const [contact, people, history, activities, stageConfig] = await Promise.all([
    deal.contact_id ? getContact(deal.contact_id) : null, crmStaff(), dealHistory(id), listActivities({ dealIds: [id] }), getStageConfig(),
  ]);
  return (
    <OpportunityWorkspace deal={deal} contact={contact} staff={people} history={history} activities={activities}
      stageConfig={stageConfig} readOnly={!can(staff, "crm.manage")} />
  );
}
