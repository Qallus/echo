"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { normalizeDesign } from "./schema";

export type DesignResult = { id?: string; error?: string };

// Create (id null) or update a design. The config is normalized, so only safe
// colors, text and http(s) image URLs are stored.
export async function saveDesign(id: string | null, name: string, config: unknown, opts: { workspaceId?: string | null; makeDefault?: boolean } = {}): Promise<DesignResult> {
  const user = await requireUser();
  const clean = name.trim().slice(0, 100);
  if (!clean) return { error: "Give the design a name." };
  const supabase = await createClient();
  const row = { name: clean, config: normalizeDesign(config), workspace_id: opts.workspaceId ?? null };
  if (opts.makeDefault) await supabase.from("summary_designs").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  const res = id
    ? await supabase.from("summary_designs").update({ ...row, ...(opts.makeDefault ? { is_default: true } : {}) }).eq("id", id).select("id").single()
    : await supabase.from("summary_designs").insert({ ...row, user_id: user.id, is_default: !!opts.makeDefault }).select("id").single();
  if (res.error) return { error: res.error.message };
  revalidatePath("/templates");
  return { id: res.data.id };
}

export async function deleteDesign(id: string): Promise<DesignResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("summary_designs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}

export async function setDefaultDesign(id: string): Promise<DesignResult> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("summary_designs").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  const { error } = await supabase.from("summary_designs").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}
