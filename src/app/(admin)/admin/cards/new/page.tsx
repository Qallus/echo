import { CardBuilder } from "@/components/admin/cards/card-builder";
import { can, requireStaff } from "@/lib/admin/guard";
import { newCard } from "@/lib/cards/types";
import { crmStaff } from "@/lib/crm/data";
import { getUser } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";

export const metadata = { title: "New card · Business Cards · Echo" };

export default async function NewCard() {
  const staff = await requireStaff("crm.view");
  const [people, user] = await Promise.all([crmStaff(), getUser()]);
  const me = people.find((p) => p.user_id === user?.id);
  return <CardBuilder card={newCard({ id: user?.id ?? null, name: me?.name, email: me?.email ?? user?.email })} staff={people} canAssign={can(staff, "crm.manage")} origin={siteUrl("")} />;
}
