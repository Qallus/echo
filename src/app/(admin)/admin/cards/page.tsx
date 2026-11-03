import { AdminPage } from "@/components/admin/admin-ui";
import { CardsPanel } from "@/components/admin/cards/cards-panel";
import { can, requireStaff } from "@/lib/admin/guard";
import { cardStats, listCardLeads, listCards } from "@/lib/cards/data";
import { crmStaff } from "@/lib/crm/data";
import { getUser } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";

export const metadata = { title: "Business Cards · Admin · Echo" };

// Digital business cards: builder, QR and NFC, analytics and the leads they bring in.
export default async function BusinessCards() {
  const staff = await requireStaff("crm.view");
  const [cards, stats, leads, people, user] = await Promise.all([listCards(), cardStats(30), listCardLeads(), crmStaff(), getUser()]);
  return (
    <AdminPage title="Business Cards" description="Digital cards people can save to their phone, open from a QR code or an NFC tag, and use to send you their details." className="max-w-[96rem]">
      <CardsPanel cards={cards} stats={stats} leads={leads} staff={people} me={user?.id ?? ""} origin={siteUrl("")} canManage={can(staff, "crm.manage")} />
    </AdminPage>
  );
}
