"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, RefreshCw, TriangleAlert, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { disconnectGoogle, setGoogleWorkspace, syncGoogleNow } from "./actions";

export type GoogleState =
  | { connected: false }
  | { connected: true; email: string | null; workspaceId: string | null; status: "active" | "error"; lastError: string | null; lastSyncedAt: string | null };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString();
};

export function GoogleCard({ state, available, workspaces }: { state: GoogleState; available: boolean; workspaces: { value: string; label: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => { setMsg(await fn()); router.refresh(); });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <CalendarDays className="size-5" /> Google Calendar
          {state.connected && (state.status === "active"
            ? <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-3" /> Connected</Badge>
            : <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-300"><TriangleAlert className="size-3" /> Needs attention</Badge>)}
        </CardTitle>
        <CardDescription>
          Two-way sync: events you add or change in Redial appear in Google Calendar, and changes in Google Calendar come back to Redial.
          Redial never sends invitations to the people on an event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!available ? (
          <p className="text-muted-foreground">Coming soon.</p>
        ) : !state.connected ? (
          <div className="space-y-2">
            <Button nativeButton={false} render={<a href="/api/integrations/google/start" />}>Connect Google</Button>
            <p className="text-xs text-muted-foreground">Google shows you exactly what Redial can see before you agree. You can disconnect any time.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-1">
              <p><span className="text-muted-foreground">Account:</span> {state.email ?? "Google account"}</p>
              <p className="text-muted-foreground">{state.lastSyncedAt ? `Last synced ${ago(state.lastSyncedAt)}` : "Not synced yet"}</p>
              {state.lastError && <p className="text-destructive">{state.lastError}</p>}
            </div>
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="google-ws">Sync with this Redial calendar</Label>
              <Pick id="google-ws" label="Redial calendar" options={workspaces} value={state.workspaceId ?? ""} onChange={(v) => v && run(() => setGoogleWorkspace(v))} disabled={pending} />
              <p className="text-xs text-muted-foreground">Events from the last 30 days on are synced with your main Google Calendar.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.status === "error"
                ? <Button nativeButton={false} render={<a href="/api/integrations/google/start" />}>Reconnect Google</Button>
                : <Button variant="outline" disabled={pending} onClick={() => run(async () => {
                    const r = await syncGoogleNow();
                    return r.error ? { error: r.error } : { ok: `Synced: ${r.pushed} sent to Google, ${r.pulled} brought in, ${r.removed} removed.` };
                  })}><RefreshCw className={pending ? "animate-spin" : undefined} /> Sync now</Button>}
              <Button variant="ghost" disabled={pending} onClick={() => confirm("Disconnect Google? Events already synced stay in both calendars, but changes stop syncing.") && run(disconnectGoogle)}>
                <Unplug /> Disconnect
              </Button>
            </div>
          </>
        )}
        {(msg.ok || msg.error) && <p className={msg.error ? "text-destructive" : "text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      </CardContent>
    </Card>
  );
}
