import "server-only";
import { createClient } from "@/lib/supabase/server";

// Document reads for the admin (RLS: crm.view).

export type Folder = { id: string; name: string; parent_id: string | null; created_at: string };
export type Doc = {
  id: string; folder_id: string | null; name: string; path: string; size: number; mime: string | null; tags: string[]; notes: string | null;
  company_id: string | null; contact_id: string | null; deal_id: string | null; plan_id: string | null; uploaded_by: string | null; created_at: string; updated_at: string;
};

export async function listFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("doc_folders").select("id, name, parent_id, created_at").order("name");
  return (data ?? []) as Folder[];
}

export async function listDocuments(filter: { companyId?: string; contactId?: string; dealId?: string } = {}): Promise<Doc[]> {
  const supabase = await createClient();
  let q = supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(2000);
  if (filter.companyId) q = q.eq("company_id", filter.companyId);
  if (filter.contactId) q = q.eq("contact_id", filter.contactId);
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  const { data } = await q;
  return (data ?? []) as Doc[];
}
