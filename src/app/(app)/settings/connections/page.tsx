import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listWorkspaces, requireUser } from "@/lib/data";
import { googleKeys } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";
import { GoogleCard, type GoogleState } from "./google-card";

export const metadata = { title: "Connected accounts · Settings · Redial" };

const ERRORS: Record<string, string> = {
  google_denied: "Google wasn't connected because the permission screen was closed or declined.",
  google_state: "That sign-in link expired. Click Connect Google again.",
  google_failed: "Google couldn't be connected. Try again in a minute.",
  google_not_configured: "Google isn't available yet.",
};

// Accounts people link to Redial. Google Calendar first; Microsoft and Apple next.
export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ connected, error }, keys, workspaces, { data }] = await Promise.all([
    searchParams, googleKeys(), listWorkspaces(),
    supabase.from("account_connections").select("account_email, workspace_id, status, last_error, last_synced_at").eq("user_id", user.id).eq("provider", "google").maybeSingle(),
  ]);
  const google: GoogleState = data
    ? { connected: true, email: data.account_email, workspaceId: data.workspace_id, status: data.status, lastError: data.last_error, lastSyncedAt: data.last_synced_at }
    : { connected: false };

  return (
    <div className="max-w-3xl space-y-6">
      {connected === "google" && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">Google is connected and your calendar has synced.</p>}
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{ERRORS[error] ?? "Something went wrong."}</p>}

      <GoogleCard state={google} available={Boolean(keys)} workspaces={workspaces.map((w) => ({ value: w.id, label: w.isPersonal ? `${w.name} (personal)` : w.name }))} />

      <Card>
        <CardHeader>
          <CardTitle>Microsoft and Apple</CardTitle>
          <CardDescription>Outlook calendar, and iCloud calendar on iPhone, are coming soon.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Redial only uses a connected account for the features you turn on. See <a href="/privacy#google-user-data" className="underline">how we handle connected account data</a>.
        </CardContent>
      </Card>
    </div>
  );
}
