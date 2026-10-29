import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionGroup, Folder, Recording, RecordingDetail, Summary, Workspace, WorkspaceRole,
} from "@/lib/types";

// All reads go through the signed-in user's client, so RLS decides access.
// cache() dedupes calls within one request (layout + page).

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? "" };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// The user's current workspace: their personal one for now (picker comes later).
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, is_personal)")
    .eq("user_id", user.id)
    .order("is_personal", { referencedTable: "workspaces", ascending: false })
    .order("created_at")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No workspace for user: ${error?.message ?? "none found"}`);
  const ws = data.workspaces as unknown as { id: string; name: string; is_personal: boolean };
  return { id: ws.id, name: ws.name, isPersonal: ws.is_personal, role: data.role as WorkspaceRole };
});

type RecordingRow = {
  id: string; title: string; source: Recording["source"]; status: Recording["status"];
  duration_sec: number; created_at: string; folder_id: string | null; deleted_at: string | null;
};
const RECORDING_COLS = "id, title, source, status, duration_sec, created_at, folder_id, deleted_at";
const toRecording = (r: RecordingRow): Recording => ({
  id: r.id, title: r.title, source: r.source, status: r.status, durationSec: r.duration_sec,
  createdAt: r.created_at, folderId: r.folder_id, deletedAt: r.deleted_at,
});

// Every recording in the workspace, trash included (sidebar counts need both).
export const listRecordings = cache(async (): Promise<Recording[]> => {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings").select(RECORDING_COLS)
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RecordingRow[]).map(toRecording);
});

export const listFolders = cache(async (): Promise<Folder[]> => {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select("id, name").eq("workspace_id", ws.id).order("name");
  if (error) throw new Error(error.message);
  return data;
});

export async function getRecordingDetail(id: string): Promise<RecordingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [rec, segs, hls, sum, items] = await Promise.all([
    supabase.from("recordings").select(RECORDING_COLS).eq("id", id).maybeSingle(),
    supabase.from("transcript_segments").select("speaker, start_sec, text").eq("recording_id", id).order("position"),
    supabase.from("highlights").select("start_sec, text").eq("recording_id", id).order("start_sec"),
    supabase.from("summaries").select("template, model, overview, key_points, mind_map").eq("recording_id", id).maybeSingle(),
    supabase.from("action_items").select("id, owner_name, owner_role, text, done").eq("recording_id", id).order("position"),
  ]);
  if (!rec.data) return null;

  let summary: Summary | null = null;
  if (sum.data) {
    const groups = new Map<string, ActionGroup>();
    for (const it of items.data ?? []) {
      const owner = it.owner_name ?? "Unassigned";
      if (!groups.has(owner)) groups.set(owner, { owner, role: it.owner_role, items: [] });
      groups.get(owner)!.items.push({ id: it.id, text: it.text, done: it.done });
    }
    const mm = (sum.data.mind_map ?? {}) as { root?: string; branches?: string[] };
    summary = {
      template: sum.data.template,
      model: sum.data.model,
      overview: sum.data.overview,
      keyPoints: (sum.data.key_points ?? []) as string[],
      actionGroups: [...groups.values()],
      mindMap: { root: mm.root ?? rec.data.title, branches: mm.branches ?? [] },
    };
  }

  return {
    recording: toRecording(rec.data as RecordingRow),
    segments: (segs.data ?? []).map((s) => ({ speaker: s.speaker, startSec: s.start_sec, text: s.text })),
    highlights: (hls.data ?? []).map((h) => ({ startSec: h.start_sec, text: h.text })),
    summary,
  };
}
