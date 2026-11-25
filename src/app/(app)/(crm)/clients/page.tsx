import Admin from "@/app/(admin)/admin/clients/page";
import { workspaceCrmReady } from "@/lib/crm/scope";
import Soon from "./soon";

export const metadata = { title: "Clients · Redial" };

// The workspace's own Clients: the same page as Admin, scoped to the chosen
// Personal or Business workspace (lib/crm/scope.ts).
export default async function Page() {
  if (!(await workspaceCrmReady())) return <Soon />;
  return <Admin />;
}
