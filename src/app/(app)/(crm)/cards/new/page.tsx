import { notFound } from "next/navigation";
import Admin from "@/app/(admin)/admin/cards/new/page";
import { workspaceCrmReady } from "@/lib/crm/scope";

export const metadata = { title: "New card · Redial" };

export default async function Page() {
  if (!(await workspaceCrmReady())) notFound();
  return <Admin />;
}
