import { notFound } from "next/navigation";
import Admin from "@/app/(admin)/admin/cards/[id]/nfc/page";
import { workspaceCrmReady } from "@/lib/crm/scope";

export const metadata = { title: "Card NFC · Redial" };

export default async function Page(props: Parameters<typeof Admin>[0]) {
  if (!(await workspaceCrmReady())) notFound();
  return <Admin {...props} />;
}
