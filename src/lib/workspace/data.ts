import "server-only";
import { createClient } from "@/lib/supabase/server";

// Workspace reads (RLS: team docs for staff with crm.view, private docs for
// their author only).

export type WorkspaceDocMeta = {
  id: string; title: string; icon: string | null; parent_id: string | null; visibility: "team" | "private"; pinned: boolean;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
};
export type WorkspaceDoc = WorkspaceDocMeta & { content: Record<string, unknown>; company_id: string | null; deal_id: string | null };
export type WorkspaceComment = { id: string; doc_id: string; body: string; quote: string | null; resolved: boolean; created_by: string | null; created_at: string };

const META = "id, title, icon, parent_id, visibility, pinned, created_by, updated_by, created_at, updated_at";

export async function listWorkspaceDocs(search?: string): Promise<WorkspaceDocMeta[]> {
  const supabase = await createClient();
  let q = supabase.from("workspace_docs").select(META).order("updated_at", { ascending: false }).limit(1000);
  const term = search?.trim().replace(/[%_,()]/g, " ").slice(0, 100);
  if (term) q = q.or(`title.ilike.%${term}%,content_text.ilike.%${term}%`);
  const { data } = await q;
  return (data ?? []) as WorkspaceDocMeta[];
}

export async function getWorkspaceDoc(id: string): Promise<WorkspaceDoc | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workspace_docs").select(`${META}, content, company_id, deal_id`).eq("id", id).maybeSingle();
  return (data as WorkspaceDoc | null) ?? null;
}

export async function listWorkspaceComments(docId: string): Promise<WorkspaceComment[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("workspace_comments").select("id, doc_id, body, quote, resolved, created_by, created_at").eq("doc_id", docId).order("created_at");
  return (data ?? []) as WorkspaceComment[];
}
