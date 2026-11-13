"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { deleteAgentProfile, setAgentListing, setAvailableNow } from "@/lib/live-agents/agent-actions";

type Status = "draft" | "pending" | "live" | "paused" | "suspended";

// "Available now" switch for live profiles.
export function AvailableNowSwitch({ on, status }: { on: boolean; status: Status }) {
  const router = useRouter();
  const [value, setValue] = useState(on);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const live = status === "live";
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-3">
        <Switch checked={value && live} disabled={!live || pending} onCheckedChange={(v) => start(async () => {
          setError(undefined);
          setValue(v);
          const r = await setAvailableNow(v);
          if (r.error) { setValue(!v); setError(r.error); } else router.refresh();
        })} />
        <span className="text-sm font-medium">{value && live ? "Available now" : "Offline"}</span>
      </label>
      <p className="text-xs text-muted-foreground">{live ? "When on, businesses see you as ready for on-demand calls." : "Turns on once your profile is live."}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Pause / resume / withdraw, and delete.
export function ListingActions({ status }: { status: Status }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => start(async () => {
    setError(undefined);
    const r = await fn();
    if (r.error) setError(r.error); else { after?.(); router.refresh(); }
  });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "live" && <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setAgentListing("pause"))}><Pause /> Pause listing</Button>}
        {status === "paused" && <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setAgentListing("resume"))}><Play /> Show my profile again</Button>}
        {status === "pending" && <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setAgentListing("withdraw"))}><Undo2 /> Withdraw to keep editing</Button>}
        {status !== "suspended" && <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => setConfirm(true)}><Trash2 /> Delete profile</Button>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Delete your Live Agent profile?" description="This removes your profile, photo and voice clips for good. You can start a new profile any time.">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(deleteAgentProfile, () => setConfirm(false))}>{pending ? "Deleting…" : "Delete profile"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
