import { AdminPage } from "@/components/admin/admin-ui";
import { PlansIndex } from "@/components/admin/plans/plans-index";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff, listCompanies } from "@/lib/crm/data";
import { listPlans } from "@/lib/plans/data";

export const metadata = { title: "Plans · Admin · Echo" };

// Task plans: onboarding, projects, launches; started from templates.
export default async function Plans() {
  const staff = await requireStaff("crm.view");
  const [plans, companies, people] = await Promise.all([listPlans(), listCompanies(), crmStaff()]);
  return (
    <AdminPage title="Plans" description="Task plans for onboarding, projects and launches: boards, lists, grids and calendars." className="max-w-[96rem]">
      <PlansIndex plans={plans} companies={companies.map(({ id, name }) => ({ id, name }))} staff={people}
        readOnly={!can(staff, "crm.manage") && !can(staff, "projects.manage")} />
    </AdminPage>
  );
}
