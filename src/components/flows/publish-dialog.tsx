"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Rocket } from "lucide-react";
import { useBuilder } from "@/components/flows/builder-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { publishFlow } from "@/lib/flows/actions";
import type { Issue } from "@/lib/flows/schema";

// Publish the draft as the next version and choose which lines answer with
// it. Calls follow the published version; the draft can keep changing.

export function PublishDialog({ open, onOpenChange, flowId, issues, saved, lineIds, nextVersion }: {
  open: boolean; onOpenChange: (o: boolean) => void; flowId: string; issues: Issue[]; saved: boolean; lineIds: string[]; nextVersion: number;
}) {
  const { lines } = useBuilder();
  const router = useRouter();
  const manageable = lines.filter((l) => l.canManage);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>(lineIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const errors = issues.filter((i) => i.level === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={`Publish version ${nextVersion}`} description="Calls on the lines you choose follow this version right away. You can keep editing the draft and publish again, or roll back." className="max-w-lg">
          {errors.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4 text-destructive" /> Fix these first</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs">{errors.slice(0, 6).map((e, i) => <li key={i}>{e.message}</li>)}</ul>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Lines that answer with this call tree</p>
                {manageable.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You don&apos;t have a Redial line yet. You can publish now and choose a line once it&apos;s set up. <Link href="/setup" className="underline underline-offset-4">Set up Redial</Link></p>
                ) : manageable.map((l) => (
                  <label key={l.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <Checkbox checked={picked.includes(l.id)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, l.id] : p.filter((x) => x !== l.id)))} className="mt-0.5" />
                    <span>
                      <span className="block font-medium">{l.label} · {l.number}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.flowId && l.flowId !== flowId ? `Answers with "${l.flowName}" now; this replaces it.` : l.flowId === flowId ? "Answers with this call tree." : "Answers with its usual screening now."}
                      </span>
                    </span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">Blocked callers are still turned away, and VIPs still ring straight through.</p>
              </div>
              <label className="block space-y-1.5"><span className="text-sm font-medium">What changed <span className="font-normal text-muted-foreground">(optional)</span></span>
                <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="New holiday hours" />
              </label>
              {issues.length > 0 && <p className="text-xs text-muted-foreground">{issues.length} {issues.length === 1 ? "warning" : "warnings"}: unconnected outputs follow the call tree&apos;s fallback.</p>}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={pending || errors.length > 0 || !saved} onClick={() => start(async () => {
              const r = await publishFlow(flowId, note, picked);
              if (r.error && !r.version) { setError(r.error); return; }
              setError(r.error ?? null);
              if (!r.error) onOpenChange(false);
              router.refresh();
            })}><Rocket /> {!saved ? "Saving…" : pending ? "Publishing…" : "Publish"}</Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
