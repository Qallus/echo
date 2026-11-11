"use client";

import { useState, useTransition } from "react";
import { History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rollbackFlow } from "@/lib/flows/actions";
import type { FlowVersion } from "@/lib/flows/data";

// Published versions. Rolling back makes an older version live again and
// copies it into the draft.

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function VersionsSheet({ open, onOpenChange, flowId, versions }: { open: boolean; onOpenChange: (o: boolean) => void; flowId: string; versions: FlowVersion[] }) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><History className="size-4" /> Versions</SheetTitle>
          <SheetDescription>Every time you publish, the call tree is saved as a version. Calls follow the live one.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          {versions.length === 0 && <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
          {versions.map((v) => (
            <div key={v.version} className="rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <p className="font-medium">Version {v.version}</p>
                {v.current && <Badge>Live</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{when(v.publishedAt)}</span>
              </div>
              {v.note && <p className="mt-1 text-sm text-muted-foreground">{v.note}</p>}
              {!v.current && (
                confirm === v.version ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span>Make version {v.version} live and replace the draft with it?</span>
                    <Button size="sm" disabled={pending} onClick={() => start(async () => {
                      const r = await rollbackFlow(flowId, v.version);
                      if (r.error) { setMsg(r.error); return; }
                      window.location.reload();
                    })}>Roll back</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
                  </div>
                ) : <Button size="sm" variant="outline" className="mt-2" onClick={() => setConfirm(v.version)}><RotateCcw /> Roll back to this</Button>
              )}
            </div>
          ))}
          {msg && <p className="text-sm text-destructive">{msg}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
