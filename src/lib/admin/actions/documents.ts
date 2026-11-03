"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { can, requireStaff } from "@/lib/admin/guard";
import { list, ref, text, uuids, type Result } from "@/lib/crm/validate";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Documents (crm.manage or projects.manage to change; crm.view to open).
// Files go straight from the browser to the private "documents" bucket at
// <document id>/<file name>; this records them and hands out signed links.

async function editor() {
  const staff = await requireStaff("crm.view");
  if (!can(staff, "crm.manage") && !can(staff, "projects.manage")) throw new Error("You can view documents but not change them.");
}
const done = <T extends Result>(r: T): T => { revalidatePath("/admin/documents"); return r; };

export async function createFolder(name: string, parentId: string | null): Promise<Result> {
  await editor();
  const n = text(name, 120);
  if (!n) return { error: "Name the folder." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("doc_folders").insert({ name: n, parent_id: ref(parentId) }).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, "documents.folder.create", { type: "doc_folder", id: data.id }, { name: n });
  return done({ ok: "Folder created.", id: data.id });
}

export async function renameFolder(id: string, name: string): Promise<Result> {
  await editor();
  const n = text(name, 120);
  if (!isUuid(id) || !n) return { error: "Name the folder." };
  const supabase = await createClient();
  const { error } = await supabase.from("doc_folders").update({ name: n }).eq("id", id);
  return error ? { error: error.message } : done({ ok: "Renamed." });
}

export async function deleteFolder(id: string): Promise<Result> {
  await editor();
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("doc_folders").delete().eq("id", id);
  if (error) return { error: error.message };
  await adminAudit(supabase, "documents.folder.delete", { type: "doc_folder", id });
  return done({ ok: "Folder deleted. Its files moved to All files." });
}

// After the browser uploads a file, record it.
export async function registerDocument(input: { id: string; name: string; path: string; size: number; mime: string; folder_id?: string | null; company_id?: string | null; contact_id?: string | null; deal_id?: string | null }): Promise<Result> {
  await editor();
  if (!isUuid(input.id) || !input.path.startsWith(`${input.id}/`)) return { error: "Upload didn't finish. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    id: input.id, name: text(input.name, 255) ?? "file", path: input.path.slice(0, 500), size: Math.max(0, Math.round(input.size)), mime: text(input.mime, 200),
    folder_id: ref(input.folder_id), company_id: ref(input.company_id), contact_id: ref(input.contact_id), deal_id: ref(input.deal_id),
  });
  if (error) {
    await supabase.storage.from("documents").remove([input.path]);
    return { error: error.message };
  }
  await adminAudit(supabase, "documents.upload", { type: "document", id: input.id }, { name: input.name, size: input.size });
  return done({ ok: "Uploaded." });
}

export async function updateDocument(id: string, patch: { name?: string; folder_id?: string | null; tags?: string | string[]; notes?: string | null; company_id?: string | null; contact_id?: string | null; deal_id?: string | null; plan_id?: string | null }): Promise<Result> {
  await editor();
  if (!isUuid(id)) return { error: "Not found." };
  const row: Record<string, unknown> = {};
  if ("name" in patch) { const n = text(patch.name, 255); if (!n) return { error: "Name the file." }; row.name = n; }
  if ("tags" in patch) row.tags = list(patch.tags);
  if ("notes" in patch) row.notes = text(patch.notes, 5000);
  for (const k of ["folder_id", "company_id", "contact_id", "deal_id", "plan_id"] as const) if (k in patch) row[k] = ref(patch[k]);
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update(row).eq("id", id);
  return error ? { error: error.message } : done({ ok: "Saved." });
}

export async function moveDocuments(ids: string[], folderId: string | null): Promise<Result> {
  await editor();
  const targets = uuids(ids);
  if (!targets.length) return { error: "Select files first." };
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ folder_id: ref(folderId) }).in("id", targets);
  return error ? { error: error.message } : done({ ok: `${targets.length} moved.` });
}

export async function tagDocuments(ids: string[], tags: string): Promise<Result> {
  await editor();
  const targets = uuids(ids);
  const add = list(tags);
  if (!targets.length || !add.length) return { error: "Nothing to tag." };
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("id, tags").in("id", targets);
  await Promise.all((data ?? []).map((d) => supabase.from("documents").update({ tags: [...new Set([...(d.tags as string[]), ...add])].slice(0, 20) }).eq("id", d.id)));
  return done({ ok: `${targets.length} tagged.` });
}

export async function deleteDocuments(ids: string[]): Promise<Result> {
  await editor();
  const targets = uuids(ids);
  if (!targets.length) return { error: "Select files first." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").delete().in("id", targets).select("path, name");
  if (error) return { error: error.message };
  if (data?.length) await supabase.storage.from("documents").remove(data.map((d) => d.path));
  await adminAudit(supabase, "documents.delete", { type: "document", id: targets[0] }, { count: data?.length ?? 0, names: (data ?? []).slice(0, 10).map((d) => d.name) });
  return done({ ok: `${data?.length ?? 0} deleted.` });
}

// A signed link: short for opening here, up to 7 days for sharing outside.
export async function documentLink(id: string, days = 0): Promise<{ url?: string; error?: string }> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("path, name").eq("id", id).maybeSingle();
  if (!doc) return { error: "Not found." };
  const seconds = days > 0 ? Math.min(7, Math.round(days)) * 86400 : 3600;
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.path, seconds, days > 0 ? { download: doc.name } : undefined);
  if (error) return { error: error.message };
  if (days > 0) await adminAudit(supabase, "documents.share", { type: "document", id }, { days });
  return { url: data.signedUrl };
}
