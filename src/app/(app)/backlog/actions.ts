"use server";

import { revalidatePath } from "next/cache";
import { isUuid, requireUser } from "@/lib/data";
import { AREAS, KINDS, PRIORITIES, STATUSES } from "@/lib/backlog";
import { createClient } from "@/lib/supabase/server";

// Backlog writes from the dashboard. RLS: members read/add/edit; the creator
// or a workspace owner/admin deletes; comments are editable by their author.

export type BacklogState = { error?: string; ok?: boolean };
const oneOf = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(String(v)) ? (v as T[number]) : fallback;

export async function createRequest(_: BacklogState, form: FormData): Promise<BacklogState> {
  const user = await requireUser();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const workspaceId = String(form.get("workspace_id") ?? "");
  if (!title) return { error: "Give the item a title." };
  if (!isUuid(workspaceId)) return { error: "Choose a workspace." };
  const supabase = await createClient();
  const { error } = await supabase.from("dev_requests").insert({
    workspace_id: workspaceId, created_by: user.id, title, source: "dashboard",
    details: String(form.get("details") ?? "").trim().slice(0, 20_000),
    kind: oneOf(KINDS, form.get("kind"), "feature"),
    area: oneOf(AREAS, form.get("area"), "other"),
    priority: oneOf(PRIORITIES, form.get("priority"), "normal"),
  });
  if (error) return { error: error.message };
  revalidatePath("/backlog");
  return { ok: true };
}

export async function updateRequest(id: string, fields: { status?: string; priority?: string; area?: string; kind?: string; title?: string; details?: string }) {
  await requireUser();
  if (!isUuid(id)) return { error: "Unknown item." };
  const changes: Record<string, string> = {};
  if (fields.status) changes.status = oneOf(STATUSES, fields.status, "new");
  if (fields.priority) changes.priority = oneOf(PRIORITIES, fields.priority, "normal");
  if (fields.area) changes.area = oneOf(AREAS, fields.area, "other");
  if (fields.kind) changes.kind = oneOf(KINDS, fields.kind, "feature");
  if (fields.title?.trim()) changes.title = fields.title.trim().slice(0, 200);
  if (fields.details !== undefined) changes.details = fields.details.trim().slice(0, 20_000);
  const supabase = await createClient();
  const { error, count } = await supabase.from("dev_requests").update(changes, { count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Item not found or you don't have access." };
  revalidatePath("/backlog");
  return {};
}

export type Comment = { id: string; author_label: string | null; body: string; created_at: string; mine: boolean };
export type RequestDetail = {
  id: string; workspace_id: string; title: string; details: string; kind: string; area: string; priority: string;
  status: string; source: string; created_at: string; updated_at: string; comments: Comment[];
};

export async function getRequestDetail(id: string): Promise<RequestDetail | null> {
  const user = await requireUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const [req, comments] = await Promise.all([
    supabase.from("dev_requests").select("id, workspace_id, title, details, kind, area, priority, status, source, created_at, updated_at").eq("id", id).maybeSingle(),
    supabase.from("dev_request_comments").select("id, author_id, author_label, body, created_at").eq("request_id", id).order("created_at"),
  ]);
  if (!req.data) return null;
  return {
    ...req.data,
    comments: (comments.data ?? []).map(({ author_id, ...c }) => ({ ...c, mine: author_id === user.id })),
  };
}

export async function addComment(id: string, body: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const text = body.trim().slice(0, 20_000);
  if (!isUuid(id) || !text) return { error: "Write a comment first." };
  const supabase = await createClient();
  const { error } = await supabase.from("dev_request_comments").insert({ request_id: id, body: text, author_id: user.id, author_label: null });
  if (error) return { error: error.message };
  revalidatePath("/backlog");
  return {};
}

export async function deleteRequest(id: string): Promise<{ error?: string }> {
  await requireUser();
  if (!isUuid(id)) return { error: "Unknown item." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("dev_requests").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the person who added this item, or a workspace owner/admin, can delete it." };
  revalidatePath("/backlog");
  return {};
}
