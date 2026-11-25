import Admin from "@/app/(admin)/admin/plans/page";
import { workspaceCrmReady } from "@/lib/crm/scope";
import Soon from "./soon";

export const metadata = { title: "Plans · Redial" };

// The workspace's own Plans: the same page as Admin, scoped to the chosen
// Personal or Business workspace (lib/crm/scope.ts).
export default async function Page() {
  if (!(await workspaceCrmReady())) return <Soon />;
  return <Admin />;
}
