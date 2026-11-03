"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { sendText } from "@/lib/admin/actions/comms-phone";

// Send a text from Echo's number to one contact (logs on their timeline).
export function TextDialog({ to, name, contactId, dealId, onClose }: { to: string; name: string; contactId?: string | null; dealId?: string | null; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Text ${name}`} description={to}>
        <Textarea autoFocus rows={5} maxLength={1600} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" aria-label="Message" />
        <p className="text-right text-[11px] text-muted-foreground">{body.length}/1600</p>
        {(result.ok || result.error) && <p className={result.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{result.error ?? result.ok}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{result.ok ? "Done" : "Cancel"}</Button>
          {!result.ok && <Button disabled={pending || !body.trim()} onClick={() => start(async () => setResult(await sendText({ to, body, contactId, dealId })))}>{pending ? "Sending…" : "Send text"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
