"use server";

import { revalidatePath } from "next/cache";
import { isUuid, listWorkspaces, requireUser } from "@/lib/data";
import { syncGoogleCalendar, type SyncResult } from "@/lib/google/calendar-sync";
import { revoke, CONNECTION_COLS, type Connection } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

// Settings -> Connected accounts: sync now, pick the Redial calendar to sync,
// and disconnect (revokes Google's grant and deletes the stored tokens).

export async function syncGoogleNow(): Promise<SyncResult> {
  const user = await requireUser();
  const res = await syncGoogleCalendar(await createClient(), user.id);
  revalidatePath("/calendar");
  revalidatePath("/settings/connections");
  return res;
}

// Sync quietly when the calendar opens, at most every two minutes.
export async function syncGoogleIfStale(): Promise<{ changed: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("account_connections").select("status, last_synced_at, workspace_id").eq("user_id", user.id).eq("provider", "google").maybeSingle();
  if (!data || data.status !== "active" || !data.workspace_id) return { changed: false };
  if (data.last_synced_at && Date.now() - Date.parse(data.last_synced_at) < 120_000) return { changed: false };
  const res = await syncGoogleCalendar(supabase, user.id);
  const changed = res.pulled + res.removed > 0;
  if (changed) revalidatePath("/calendar");
  return { changed };
}

export async function setGoogleWorkspace(workspaceId: string): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  if (!isUuid(workspaceId) || !(await listWorkspaces()).some((w) => w.id === workspaceId)) return { error: "Pick one of your workspaces." };
  const supabase = await createClient();
  const { data: conn } = await supabase.from("account_connections").select("id, workspace_id").eq("user_id", user.id).eq("provider", "google").maybeSingle();
  if (!conn) return { error: "Google isn't connected." };
  if (conn.workspace_id === workspaceId) return { ok: "Saved." };
  // A different Redial calendar: forget the old pairings and sync from scratch.
  await supabase.from("calendar_sync_links").delete().eq("connection_id", conn.id);
  const { error } = await supabase.from("account_connections").update({ workspace_id: workspaceId, sync_token: null }).eq("id", conn.id);
  if (error) return { error: error.message };
  const res = await syncGoogleCalendar(supabase, user.id);
  revalidatePath("/settings/connections");
  revalidatePath("/calendar");
  return res.error ? { error: res.error } : { ok: "Saved and synced." };
}

export async function disconnectGoogle(): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("account_connections").select(CONNECTION_COLS).eq("user_id", user.id).eq("provider", "google").maybeSingle();
  if (!data) return { ok: "Google is disconnected." };
  await revoke(data as Connection);
  const { error } = await supabase.from("account_connections").delete().eq("id", data.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/connections");
  return { ok: "Google is disconnected. Events already synced stay in both calendars." };
}
