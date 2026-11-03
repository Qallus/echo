import { notFound } from "next/navigation";
import { PlanWorkspace } from "@/components/admin/plans/plan-workspace";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies } from "@/lib/crm/data";
import { isUuid } from "@/lib/data";
import { getPlan } from "@/lib/plans/data";

export const metadata = { title: "Plan · Admin · Echo" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("crm.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [data, people, companies] = await Promise.all([getPlan(id), crmStaff(), listCompanies()]);
  if (!data) notFound();
  return (
    <PlanWorkspace plan={data.plan} groups={data.groups} tasks={data.tasks} staff={people} companies={companies.map(({ id, name }) => ({ id, name }))}
      readOnly={!can(staff, "crm.manage") && !can(staff, "projects.manage")} />
  );
}
