"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Loader2, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQr } from "@/components/cards/card-preview";

type NdefWriter = { write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void> };
type W = Window & { NDEFReader?: new () => NdefWriter };

// Web NFC works in Chrome on Android only.
export function useWebNfc() {
  return useSyncExternalStore(() => () => {}, () => typeof (window as W).NDEFReader === "function", () => false);
}

export function NfcWriter({ url, onWritten }: { url: string; onWritten?: () => void }) {
  const supported = useWebNfc();
  const [state, setState] = useState<"idle" | "waiting" | "done" | string>("idle");
  if (!supported) return <p className="text-xs text-muted-foreground">Writing tags works in Chrome on Android. From the card list, <span className="font-medium text-foreground">Write NFC</span> shows a QR code that opens the writer on your phone.</p>;
  async function write() {
    try {
      setState("waiting");
      await new (window as W).NDEFReader!().write({ records: [{ recordType: "url", data: url }] });
      setState("done");
      onWritten?.();
    } catch (e) { setState(e instanceof Error ? e.message : "Couldn't write the tag."); }
  }
  return (
    <div className="space-y-2">
      <Button size="sm" onClick={() => void write()} disabled={state === "waiting"}>
        {state === "waiting" ? <Loader2 className="animate-spin" /> : state === "done" ? <Check /> : <Nfc />}
        {state === "waiting" ? "Hold a tag to the back of your phone…" : state === "done" ? "Tag written. Write another" : "Write NFC tag"}
      </Button>
      {!["idle", "waiting", "done"].includes(state) && <p className="text-xs text-destructive">{state}</p>}
    </div>
  );
}

// From the card list: write here on Android, otherwise scan to open the writer on a phone.
export function NfcDialog({ open, onOpenChange, name, tagUrl, writerUrl, onWritten }: {
  open: boolean; onOpenChange: (o: boolean) => void; name: string; tagUrl: string; writerUrl: string; onWritten: () => void;
}) {
  const supported = useWebNfc();
  const qr = useQr(writerUrl, 480);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Write NFC tag" description={`Program a tag so a tap opens ${name}'s card.`} className="sm:max-w-sm">
        {supported ? <NfcWriter url={tagUrl} onWritten={onWritten} /> : (
          <div className="space-y-3 text-center">
            {qr && <img src={qr} alt="QR code to open the NFC writer on your phone" className="mx-auto w-56 rounded-lg border bg-white p-2" />} {/* eslint-disable-line @next/next/no-img-element */}
            <p className="text-sm text-muted-foreground">Scan with an Android phone (Chrome, signed in to Echo), then tap <span className="font-medium text-foreground">Write NFC tag</span>.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
