"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "./data";
import { isKind, isStatus } from "./types";

// Recording Studio edits. Everything runs as the signed-in person; RLS limits
// it to their own recordings and files.

type Result = { ok?: string; error?: string };
const done = (ok: string): Result => { revalidatePath("/studio"); return { ok }; };
const ids = (v: string[]) => v.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);

export async function updateStudioAudio(id: string, f: { name: string; description: string; kind: string; status: string; image: string | null }): Promise<Result> {
  await requireUser();
  if (!f.name.trim()) return { error: "Give the recording a name." };
  if (!isKind(f.kind) || !isStatus(f.status)) return { error: "Choose what it's for and its status." };
  if (f.image && (!f.image.startsWith("data:image/") || f.image.length > 400000)) return { error: "That image is too large." };
  const supabase = await createClient();
  const { error } = await supabase.from("studio_audio").update({
    name: f.name.trim().slice(0, 120), description: f.description.trim().slice(0, 1000) || null, kind: f.kind, status: f.status, image: f.image,
  }).eq("id", id);
  return error ? { error: "Couldn't save the changes." } : done("Saved.");
}

export async function archiveStudioAudio(list: string[], archived: boolean): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("studio_audio").update({ archived_at: archived ? new Date().toISOString() : null }).in("id", ids(list));
  return error ? { error: "Couldn't update those recordings." } : done(archived ? "Archived." : "Restored.");
}

export async function deleteStudioAudio(list: string[]): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("studio_audio").select("id, storage_path").in("id", ids(list));
  if (!data?.length) return { error: "Nothing to delete." };
  await supabase.storage.from(BUCKET).remove(data.map((r) => r.storage_path));
  const { error } = await supabase.from("studio_audio").delete().in("id", data.map((r) => r.id));
  return error ? { error: "Couldn't delete those recordings." } : done(data.length === 1 ? "Deleted." : `Deleted ${data.length} recordings.`);
}
