import Admin from "@/app/(admin)/admin/pipeline/page";
import { workspaceCrmReady } from "@/lib/crm/scope";
import Soon from "./soon";

export const metadata = { title: "Pipeline · Redial" };

// The workspace's own Pipeline: the same page as Admin, scoped to the chosen
// Personal or Business workspace (lib/crm/scope.ts).
export default async function Page() {
  if (!(await workspaceCrmReady())) return <Soon />;
  return <Admin />;
}
