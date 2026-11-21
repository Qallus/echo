"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncGoogleIfStale, syncGoogleNow } from "@/app/(app)/settings/connections/actions";

// Under the Calendar heading: Google sync status, a quiet sync when the page
// opens (at most every two minutes), and Sync now.
export function GoogleSync({ connected, email }: { connected: boolean; email: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!connected) return;
    let live = true;
    syncGoogleIfStale().then((r) => { if (live && r.changed) router.refresh(); }).catch(() => {});
    return () => { live = false; };
  }, [connected, router]);

  if (!connected) {
    return <p className="text-sm text-muted-foreground"><Link href="/settings/connections" className="underline">Connect Google Calendar</Link> to keep both calendars in step.</p>;
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      Syncing with Google Calendar{email ? ` (${email})` : ""}.
      <button type="button" disabled={pending} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline disabled:opacity-60"
        onClick={() => start(async () => {
          const r = await syncGoogleNow();
          setNote(r.error ?? (r.pushed + r.pulled + r.removed ? "Synced." : "Already up to date."));
          router.refresh();
        })}>
        <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} /> Sync now
      </button>
      {note && <span>{note}</span>}
    </p>
  );
}
