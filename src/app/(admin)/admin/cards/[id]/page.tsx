import { notFound } from "next/navigation";
import { CardBuilder } from "@/components/admin/cards/card-builder";
import { can, requireStaff } from "@/lib/admin/guard";
import { getCard } from "@/lib/cards/data";
import { crmStaff } from "@/lib/crm/data";
import { getUser, isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";

export const metadata = { title: "Edit card · Business Cards · Echo" };

export default async function EditCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff("crm.view");
  if (!isUuid(id)) notFound();
  const [card, people, user] = await Promise.all([getCard(id), crmStaff(), getUser()]);
  if (!card) notFound();
  if (!can(staff, "crm.manage") && card.owner_id !== user?.id) notFound();
  return <CardBuilder key={card.updated_at} card={card} staff={people} canAssign={can(staff, "crm.manage")} origin={siteUrl("")} />;
}
