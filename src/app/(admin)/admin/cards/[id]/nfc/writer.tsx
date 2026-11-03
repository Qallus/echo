"use client";

import { NfcWriter } from "@/components/admin/cards/nfc";
import { setNfcStatus } from "@/lib/admin/actions/cards";

export function NfcWriterPage({ cardId, url }: { cardId: string; url: string }) {
  return (
    <div className="max-w-md space-y-3 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">Tap the button, then hold a blank NFC tag or card to the back of this phone.</p>
      <p className="font-mono text-xs break-all">{url}</p>
      <NfcWriter url={url} onWritten={() => void setNfcStatus(cardId, "active")} />
    </div>
  );
}
