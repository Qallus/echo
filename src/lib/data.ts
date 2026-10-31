import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionGroup, Folder, PersonCard, Profile, Recording, RecordingDetail, Summary, Workspace, WorkspaceRole,
} from "@/lib/types";

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

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

// Every workspace the user belongs to: Business ones (A–Z), then Personal.
export const listWorkspaces = cache(async (): Promise<Workspace[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, is_personal)")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return data
    .map((m) => {
      const ws = m.workspaces as unknown as { id: string; name: string; is_personal: boolean };
      return { id: ws.id, name: ws.name, isPersonal: ws.is_personal, role: m.role as WorkspaceRole };
    })
    .sort((a, b) => Number(a.isPersonal) - Number(b.isPersonal) || a.name.localeCompare(b.name));
});

// App-wide Super Admin (platform_admins); separate from workspace roles.
export const isSuperAdmin = cache(async (): Promise<boolean> => {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_i_super_admin");
  return data === true;
});

// The user's private workspace (created at sign-up).
export const getPersonalWorkspace = cache(async (): Promise<Workspace> => {
  const ws = (await listWorkspaces()).find((w) => w.isPersonal);
  if (!ws) throw new Error("No personal workspace for user");
  return ws;
});

type RecordingRow = {
  id: string; workspace_id: string; created_by: string | null; title: string; source: Recording["source"];
  status: Recording["status"]; duration_sec: number; created_at: string; folder_id: string | null; deleted_at: string | null;
};
const RECORDING_COLS = "id, workspace_id, created_by, title, source, status, duration_sec, created_at, folder_id, deleted_at";
const toRecording = (r: RecordingRow): Recording => ({
  id: r.id, workspaceId: r.workspace_id, createdBy: r.created_by, title: r.title, source: r.source, status: r.status,
  durationSec: r.duration_sec, createdAt: r.created_at, folderId: r.folder_id, deletedAt: r.deleted_at,
});

// Every recording in every workspace the user belongs to (RLS limits the rows),
// trash included (sidebar counts need both).
export const listRecordings = cache(async (): Promise<Recording[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings").select(RECORDING_COLS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RecordingRow[]).map(toRecording);
});

export const listFolders = cache(async (): Promise<Folder[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select("id, workspace_id, name").order("name");
  if (error) throw new Error(error.message);
  return data.map((f) => ({ id: f.id, workspaceId: f.workspace_id, name: f.name }));
});

export type Member = PersonCard & { role: WorkspaceRole; joinedAt: string };
export type Invite = { id: string; email: string; role: WorkspaceRole; token: string; expiresAt: string };

type MemberRow = {
  user_id: string; email: string; full_name: string | null; role: WorkspaceRole; joined_at: string;
  avatar_url: string | null; job_title: string | null; company: string | null; phone: string | null;
  timezone: string | null; location: string | null;
};

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_workspace_members", { ws: workspaceId });
  if (error) throw new Error(error.message);
  return (data as MemberRow[]).map((m) => ({
    id: m.user_id, email: m.email, fullName: m.full_name, role: m.role, joinedAt: m.joined_at,
    avatarUrl: m.avatar_url, jobTitle: m.job_title, company: m.company, phone: m.phone,
    timezone: m.timezone, location: m.location,
  }));
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .is("read_at", null).eq("show_in_app", true);
  return count ?? 0;
}

type ProfileRow = {
  full_name: string | null; avatar_url: string | null; job_title: string | null; company: string | null;
  phone: string | null; phone_visible: boolean; timezone: string | null; location: string | null;
  bio: string | null; website: string | null; linkedin: string | null; pronouns: string | null;
};

// Your own profile, phone included. The phone column isn't readable through
// the table, so this goes through get_my_profile().
export const getMyProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle<ProfileRow>();
  if (error) throw new Error(error.message);
  return {
    id: user.id, email: user.email,
    fullName: data?.full_name ?? null, avatarUrl: data?.avatar_url ?? null,
    jobTitle: data?.job_title ?? null, company: data?.company ?? null,
    phone: data?.phone ?? null, phoneVisible: data?.phone_visible ?? false,
    timezone: data?.timezone ?? null, location: data?.location ?? null,
    bio: data?.bio ?? null, website: data?.website ?? null,
    linkedin: data?.linkedin ?? null, pronouns: data?.pronouns ?? null,
  };
});

// Open invites (owners/admins only; RLS returns nothing to members).
export async function listInvites(workspaceId: string): Promise<Invite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites").select("id, email, role, token, expires_at")
    .eq("workspace_id", workspaceId).is("accepted_at", null).gt("expires_at", new Date().toISOString())
    .order("created_at");
  if (error) throw new Error(error.message);
  return data.map((i) => ({ id: i.id, email: i.email, role: i.role as WorkspaceRole, token: i.token, expiresAt: i.expires_at }));
}

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
