"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPersonalWorkspace, getRecordingDetail, isUuid, requireUser } from "@/lib/data";
import { formatClock, formatDuration } from "@/lib/format";
import { SAMPLE, SAMPLE_FOLDERS } from "@/lib/sample-data";
import { siteOrigin } from "@/lib/site";

// Server actions. Each uses the signed-in user's client, so RLS still applies.
// Database guards raise plain-English messages, so those are shown as-is.

export type ActionResult = { error?: string };

export async function toggleActionItem(id: string, done: boolean) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createFolder(name: string, workspaceId: string) {
  const clean = name.trim().slice(0, 120);
  if (!clean || !isUuid(workspaceId)) return;
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("folders").insert({ workspace_id: workspaceId, name: clean });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Business workspaces
// ---------------------------------------------------------------------------

export async function createTeamWorkspace(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give your business workspace a name." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_team_workspace", { ws_name: name });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export type InviteResult = ActionResult & { link?: string; email?: string };

export async function inviteMember(_: InviteResult, form: FormData): Promise<InviteResult> {
  await requireUser();
  const workspaceId = String(form.get("workspace_id") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = form.get("role") === "admin" ? "admin" : "member";
  if (!isUuid(workspaceId)) return { error: "Pick a workspace." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites").insert({ workspace_id: workspaceId, email, role }).select("token").single();
  if (error) {
    if (error.code === "23505") return { error: "There's already an open invite for that email. Copy its link below." };
    if (error.code === "42501") return { error: "Only owners and admins of a business workspace can invite people." };
    return { error: error.message };
  }
  revalidatePath("/team");
  return { link: `${await siteOrigin()}/invite/${data.token}`, email };
}

export async function revokeInvite(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_invites").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function removeMember(workspaceId: string, userId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("workspace_members").delete({ count: "exact" }).eq("workspace_id", workspaceId).eq("user_id", userId);
  if (error) return { error: error.message };
  if (!count) return { error: "Only owners can remove people." };
  revalidatePath("/", "layout");
  if (userId === user.id) redirect("/team");
  return {};
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  await requireUser();
  if (!isUuid(token)) return { error: "This invite link isn't valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_workspace_invite", { invite_token: token });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(`/library/space/${data}`);
}

// ---------------------------------------------------------------------------
// Bulk recording actions (select one, many or all; also used by drag and drop)
// ---------------------------------------------------------------------------

export type BulkResult = { done: number; errors: string[] };
const MAX_BULK = 200;
const cleanIds = (ids: string[]) => [...new Set(ids)].filter(isUuid).slice(0, MAX_BULK);

// Runs one update per recording so a single refusal doesn't block the rest.
async function eachRecording(ids: string[], update: Record<string, unknown>): Promise<BulkResult> {
  const supabase = await createClient();
  const results = await Promise.all(
    cleanIds(ids).map((id) => supabase.from("recordings").update(update, { count: "exact" }).eq("id", id)),
  );
  const errors = new Set<string>();
  let done = 0;
  for (const r of results) {
    if (r.error) errors.add(r.error.message);
    else if (!r.count) errors.add("Recording not found or you don't have access.");
    else done++;
  }
  return { done, errors: [...errors] };
}

// Business <-> Personal. The database allows it only for the recording's
// creator or an owner/admin, and clears the folder.
export async function moveRecordings(ids: string[], workspaceId: string): Promise<BulkResult> {
  await requireUser();
  if (!isUuid(workspaceId)) return { done: 0, errors: ["Pick a workspace."] };
  const res = await eachRecording(ids, { workspace_id: workspaceId });
  revalidatePath("/", "layout");
  return res;
}

// Puts recordings in a folder (moving them to the folder's workspace first if
// needed), or takes them out of their folder when folderId is null.
export async function fileRecordings(ids: string[], folderId: string | null): Promise<BulkResult> {
  await requireUser();
  let res: BulkResult;
  if (!folderId) res = await eachRecording(ids, { folder_id: null });
  else {
    if (!isUuid(folderId)) return { done: 0, errors: ["Pick a folder."] };
    const supabase = await createClient();
    const { data: folder } = await supabase.from("folders").select("workspace_id").eq("id", folderId).maybeSingle();
    if (!folder) return { done: 0, errors: ["Folder not found."] };
    const moved = await eachRecording(ids, { workspace_id: folder.workspace_id }); // no-op when already there
    const filed = await eachRecording(ids, { folder_id: folderId });
    res = { done: filed.done, errors: [...new Set([...moved.errors, ...filed.errors])] };
  }
  revalidatePath("/", "layout");
  return res;
}

export async function trashRecordings(ids: string[], trash: boolean): Promise<BulkResult> {
  await requireUser();
  const res = await eachRecording(ids, { deleted_at: trash ? new Date().toISOString() : null });
  revalidatePath("/", "layout");
  return res;
}

// One plain-text file: summary, key points, action items and transcript per recording.
export async function exportRecordings(ids: string[]): Promise<{ filename: string; text: string }> {
  await requireUser();
  const details = (await Promise.all(cleanIds(ids).map(getRecordingDetail))).filter((d) => d !== null);
  const text = details
    .map(({ recording: r, segments, summary }) => {
      const lines = [r.title, `${new Date(r.createdAt).toLocaleString("en-US")} · ${formatDuration(r.durationSec)}`, ""];
      if (summary) {
        lines.push("SUMMARY", summary.overview, "");
        if (summary.keyPoints.length) lines.push("KEY POINTS", ...summary.keyPoints.map((k) => `- ${k}`), "");
        const items = summary.actionGroups.flatMap((g) => g.items.map((i) => `- [${i.done ? "x" : " "}] ${i.text} (${g.owner})`));
        if (items.length) lines.push("ACTION ITEMS", ...items, "");
      }
      lines.push("TRANSCRIPT", ...(segments.length ? segments.map((s) => `[${formatClock(s.startSec)}] ${s.speaker}: ${s.text}`) : ["No transcript yet."]));
      return lines.join("\n");
    })
    .join("\n\n" + "=".repeat(60) + "\n\n");
  const filename = details.length === 1
    ? `${details[0].recording.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "recording"}.txt`
    : `echo-export-${details.length}-recordings.txt`;
  return { filename, text };
}

// Copies the sample recordings (with transcripts and summaries) into the Personal workspace.
export async function loadSampleData() {
  const user = await requireUser();
  const ws = await getPersonalWorkspace();
  const supabase = await createClient();

  const { data: folders, error: fErr } = await supabase
    .from("folders")
    .insert(SAMPLE_FOLDERS.map((name) => ({ workspace_id: ws.id, name })))
    .select("id, name");
  if (fErr) throw new Error(fErr.message);
  const folderId = (name: string | null) => folders.find((f) => f.name === name)?.id ?? null;

  for (const s of SAMPLE) {
    const r = s.recording;
    const { data: rec, error } = await supabase
      .from("recordings")
      .insert({
        workspace_id: ws.id, created_by: user.id, folder_id: folderId(r.folderId), title: r.title,
        source: r.source, status: r.status, duration_sec: r.durationSec, created_at: r.createdAt, deleted_at: r.deletedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const writes = [];
    if (s.segments.length) {
      writes.push(supabase.from("transcript_segments").insert(
        s.segments.map((g, i) => ({ recording_id: rec.id, position: i, speaker: g.speaker, start_sec: g.startSec, text: g.text })),
      ));
    }
    if (s.highlights.length) {
      writes.push(supabase.from("highlights").insert(
        s.highlights.map((h) => ({ recording_id: rec.id, start_sec: h.startSec, text: h.text })),
      ));
    }
    if (s.summary) {
      const sum = s.summary;
      writes.push(supabase.from("summaries").insert({
        recording_id: rec.id, template: sum.template, model: sum.model, overview: sum.overview,
        key_points: sum.keyPoints, mind_map: sum.mindMap,
      }));
      writes.push(supabase.from("action_items").insert(
        sum.actionGroups.flatMap((g) => g.items.map((it) => ({ owner_name: g.owner, owner_role: g.role, text: it.text, done: it.done })))
          .map((it, i) => ({ ...it, recording_id: rec.id, position: i })),
      ));
    }
    const results = await Promise.all(writes);
    const failed = results.find((x) => x.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
  revalidatePath("/", "layout");
}
