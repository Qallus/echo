import Admin from "@/app/(admin)/admin/leads/page";
import { workspaceCrmReady } from "@/lib/crm/scope";
import Soon from "./soon";

export const metadata = { title: "Leads · Redial" };

// The workspace's own Leads: the same page as Admin, scoped to the chosen
// Personal or Business workspace (lib/crm/scope.ts).
export default async function Page() {
  if (!(await workspaceCrmReady())) return <Soon />;
  return <Admin />;
}
