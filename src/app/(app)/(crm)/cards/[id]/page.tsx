import { notFound } from "next/navigation";
import Admin from "@/app/(admin)/admin/cards/[id]/page";
import { workspaceCrmReady } from "@/lib/crm/scope";

export const metadata = { title: "Business card · Redial" };

export default async function Page(props: Parameters<typeof Admin>[0]) {
  if (!(await workspaceCrmReady())) notFound();
  return <Admin {...props} />;
}
