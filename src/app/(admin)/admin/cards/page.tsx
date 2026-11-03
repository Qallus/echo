import { AdminPage } from "@/components/admin/admin-ui";
import { CardsPanel } from "@/components/admin/cards/cards-panel";
import { can, requireStaff } from "@/lib/admin/guard";
import { cardStats, listCardLeads, listCards } from "@/lib/cards/data";
import { crmStaff } from "@/lib/crm/data";
import { getUser } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";

export const metadata = { title: "Business Cards · Admin · Echo" };

// Digital business cards: public pages with QR and NFC, lead capture, analytics.
export default async function BusinessCards({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff("crm.view");
  const { tab } = await searchParams;
  const [cards, stats, leads, people, user] = await Promise.all([listCards(), cardStats(), listCardLeads(), crmStaff(), getUser()]);
  return (
    <AdminPage title="Business Cards" description="Digital business cards with a public page, QR code and NFC tap, lead capture and analytics." className="max-w-[96rem]">
      <CardsPanel cards={cards} stats={stats} leads={leads} staff={people} me={user?.id ?? ""} origin={siteUrl("")} canManage={can(staff, "crm.manage")}
        initialTab={tab === "leads" ? "leads" : "cards"} />
    </AdminPage>
  );
}
