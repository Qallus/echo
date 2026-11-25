import Admin from "@/app/(admin)/admin/contacts/page";
import { workspaceCrmReady } from "@/lib/crm/scope";
import Soon from "./soon";

export const metadata = { title: "Contacts · Redial" };

// The workspace's own Contacts: the same page as Admin, scoped to the chosen
// Personal or Business workspace (lib/crm/scope.ts).
export default async function Page(props: Parameters<typeof Admin>[0]) {
  if (!(await workspaceCrmReady())) return <Soon />;
  return <Admin {...props} />;
}
