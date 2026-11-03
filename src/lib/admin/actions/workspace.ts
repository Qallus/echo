"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { ref, text, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES } from "@/lib/workspace/templates";

// Workspace docs. Staff with crm.view write their own and private docs;
// editing someone else's team doc needs crm.manage or projects.manage (RLS).

const MAX_JSON = 1_900_000;

export async function createWorkspaceDoc(input: { template?: string; parent_id?: string | null; visibility?: "team" | "private" }): Promise<Result> {
  await requireStaff("crm.view");
  const tpl = TEMPLATES.find((x) => x.id === input.template) ?? TEMPLATES[0];
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_docs").insert({
    title: tpl.title, icon: tpl.icon, content: tpl.content, parent_id: ref(input.parent_id),
    visibility: input.visibility === "private" ? "private" : "team",
  }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/workspace", "layout");
  return { ok: "Created.", id: data.id };
}

// Autosave from the editor: content JSON plus plain text for search.
export async function saveWorkspaceContent(id: string, content: unknown, contentText: string): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id) || !content || typeof content !== "object") return { error: "Not found." };
  if (JSON.stringify(content).length > MAX_JSON) return { error: "This page is too large to save. Split it into sub-pages." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_docs").update({ content, content_text: String(contentText ?? "").slice(0, 500000) }).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can view this page but not edit it." };
  return { ok: "Saved." };
}

export async function updateWorkspaceDoc(id: string, patch: { title?: string; icon?: string | null; visibility?: "team" | "private"; pinned?: boolean; parent_id?: string | null }): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const row: Record<string, unknown> = {};
  if ("title" in patch) row.title = text(patch.title, 200) ?? "Untitled";
  if ("icon" in patch) row.icon = text(patch.icon, 8);
  if (patch.visibility === "team" || patch.visibility === "private") row.visibility = patch.visibility;
  if (typeof patch.pinned === "boolean") row.pinned = patch.pinned;
  if ("parent_id" in patch) {
    if (patch.parent_id === id) return { error: "A page can't be inside itself." };
    row.parent_id = ref(patch.parent_id);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_docs").update(row).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can view this page but not edit it." };
  revalidatePath("/admin/workspace", "layout");
  return { ok: "Saved." };
}

export async function deleteWorkspaceDoc(id: string): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_docs").delete().eq("id", id).select("title");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can't delete this page." };
  await adminAudit(supabase, "workspace.delete", { type: "workspace_doc", id }, { title: data[0].title });
  revalidatePath("/admin/workspace", "layout");
  return { ok: "Deleted." };
}

export async function duplicateWorkspaceDoc(id: string): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data: src } = await supabase.from("workspace_docs").select("title, icon, content, content_text, parent_id, visibility").eq("id", id).maybeSingle();
  if (!src) return { error: "Not found." };
  const { data, error } = await supabase.from("workspace_docs").insert({ ...src, title: `${src.title} (copy)`.slice(0, 200) }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/workspace", "layout");
  return { ok: "Duplicated.", id: data.id };
}

export async function addWorkspaceComment(docId: string, body: string, quote?: string | null): Promise<Result> {
  await requireStaff("crm.view");
  const b = text(body, 5000);
  if (!isUuid(docId) || !b) return { error: "Write a comment first." };
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_comments").insert({ doc_id: docId, body: b, quote: text(quote, 500) });
  if (error) return { error: error.message };
  revalidatePath(`/admin/workspace/${docId}`);
  return { ok: "Comment added." };
}

export async function resolveWorkspaceComment(id: string, docId: string, resolved: boolean): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_comments").update({ resolved }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/workspace/${docId}`);
  return { ok: resolved ? "Resolved." : "Reopened." };
}

export async function deleteWorkspaceComment(id: string, docId: string): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_comments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/workspace/${docId}`);
  return { ok: "Deleted." };
}
