import { notFound } from "next/navigation";
import Admin from "@/app/(admin)/admin/pipeline/[id]/page";
import { workspaceCrmReady } from "@/lib/crm/scope";

export const metadata = { title: "Opportunity · Redial" };

export default async function Page(props: Parameters<typeof Admin>[0]) {
  if (!(await workspaceCrmReady())) notFound();
  return <Admin {...props} />;
}
