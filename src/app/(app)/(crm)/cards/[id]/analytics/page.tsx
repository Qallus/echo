import { notFound } from "next/navigation";
import Admin from "@/app/(admin)/admin/cards/[id]/analytics/page";
import { workspaceCrmReady } from "@/lib/crm/scope";

export const metadata = { title: "Card analytics · Redial" };

export default async function Page(props: Parameters<typeof Admin>[0]) {
  if (!(await workspaceCrmReady())) notFound();
  return <Admin {...props} />;
}
