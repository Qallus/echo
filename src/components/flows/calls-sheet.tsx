"use client";

import { useEffect, useState } from "react";
import { PhoneIncoming, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { loadFlowRuns } from "@/lib/flows/actions";
import type { FlowRun } from "@/lib/flows/data";
import type { Flow } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";

// Recent calls through this call tree. Picking one highlights the path it
// took on the canvas.

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pretty = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "Unknown caller");
const OUT: Record<string, string> = {
  next: "next", open: "open", closed: "closed", holiday: "holiday", noMatch: "no match", noInput: "no input", connected: "connected", noAnswer: "no answer",
  busy: "busy", failed: "failed", recorded: "left a message", none: "no message", handoff: "to the AI assistant", extension: "dialed an extension",
  extension_voicemail: "extension voicemail", next_target: "tried the next number", saved: "saved",
};

export function CallsSheet({ open, onOpenChange, flowId, flow, picked, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; flowId: string; flow: Flow; picked: string | null; onPick: (run: FlowRun | null) => void;
}) {
  const [runs, setRuns] = useState<FlowRun[] | null>(null);
  const [loading, setLoading] = useState(false);
  const label = (id: string) => flow.nodes.find((n) => n.id === id)?.label || id;

  async function load() {
    setLoading(true);
    setRuns(await loadFlowRuns(flowId).catch(() => []));
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the panel opens
    if (open && runs === null) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per open
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><PhoneIncoming className="size-4" /> Calls</SheetTitle>
          <SheetDescription>The last 50 calls through this call tree. Pick one to see its path on the canvas.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className={cn(loading && "animate-spin")} /> Refresh</Button>
            {picked && <Button size="sm" variant="ghost" onClick={() => onPick(null)}>Clear highlight</Button>}
          </div>
          {runs?.length === 0 && <p className="text-sm text-muted-foreground">No calls yet. Once the call tree is published on a line, each call shows up here.</p>}
          {runs?.map((r) => (
            <button key={r.id} type="button" onClick={() => onPick(r)}
              className={cn("w-full space-y-2 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50", picked === r.id && "border-foreground bg-muted/50")}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{pretty(r.from)}</span>
                <Badge variant={r.status === "failed" ? "destructive" : r.status === "running" ? "default" : "secondary"}>{r.status === "running" ? "On the call" : r.status === "failed" ? "Failed" : "Ended"}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{when(r.startedAt)}</span>
              </div>
              <ol className="flex flex-wrap items-center gap-1 text-xs">
                {r.steps.map((s) => (
                  <li key={s.seq} className="rounded-md bg-muted px-1.5 py-0.5">
                    {label(s.node)}{s.transition ? <span className="text-muted-foreground"> · {OUT[s.transition] ?? s.transition}</span> : null}
                    {typeof s.data.digits === "string" && s.data.digits ? <span className="text-muted-foreground"> ({s.data.digits})</span> : null}
                  </li>
                ))}
              </ol>
              {r.version !== null && <p className="text-[11px] text-muted-foreground">Version {r.version}</p>}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
