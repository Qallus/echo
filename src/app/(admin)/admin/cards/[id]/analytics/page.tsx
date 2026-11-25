import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { CardAnalyticsView } from "@/components/admin/cards/card-analytics";
import { Button } from "@/components/ui/button";
import { crmGuard as requireStaff } from "@/lib/crm/scope";
import { getCard } from "@/lib/cards/data";
import { cardName, cardPath } from "@/lib/cards/types";
import { isUuid } from "@/lib/data";

export const metadata = { title: "Card analytics · Redial" };

export default async function CardAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("crm.view");
  if (!isUuid(id)) notFound();
  const card = await getCard(id);
  if (!card) notFound();
  return (
    <AdminPage title={cardName(card)} description="Card analytics"
      actions={<div className="flex gap-2">
        <Button variant="outline" render={<Link href="/admin/cards" />} nativeButton={false}><ArrowLeft /> All cards</Button>
        {card.status === "published" && <Button variant="outline" render={<a href={cardPath(card.slug)} target="_blank" rel="noopener noreferrer" />} nativeButton={false}><Eye /> Public page</Button>}
      </div>}>
      <CardAnalyticsView cardId={card.id} />
    </AdminPage>
  );
}
