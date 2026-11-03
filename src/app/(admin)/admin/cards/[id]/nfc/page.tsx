import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-ui";
import { NfcWriterPage } from "./writer";
import { requireStaff } from "@/lib/admin/guard";
import { getCard } from "@/lib/cards/data";
import { cardName, cardPath } from "@/lib/cards/types";
import { isUuid } from "@/lib/data";
import { siteUrl } from "@/lib/notify/senders";

export const metadata = { title: "Write NFC tag · Echo" };

// Opened on an Android phone from the QR code in "Write NFC".
export default async function NfcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("crm.view");
  if (!isUuid(id)) notFound();
  const card = await getCard(id);
  if (!card) notFound();
  return (
    <AdminPage title="Write NFC tag" description={`Program a tag so a tap opens ${cardName(card)}'s card.`}>
      <NfcWriterPage cardId={card.id} url={`${siteUrl(cardPath(card.slug))}?src=nfc`} />
    </AdminPage>
  );
}
