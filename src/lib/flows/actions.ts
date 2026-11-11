"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { starterFlow } from "./blocks";
import { flowSchema } from "./schema";

// Call Tree edits, as the signed-in person (RLS decides who can edit).

export async function createFlow(name: string): Promise<{ id?: string; error?: string }> {
  await requireUser();
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: "Give the flow a name." };
  const supabase = await createClient();
  // The id is made here: reading the new row back would go through the select
  // policy's helper, which can't see a row inserted in the same statement.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("call_flows").insert({ id, name: clean, draft: starterFlow(clean) });
  if (error) {
    console.error("[flows] create", error.message);
    return { error: "Couldn't create the flow." };
  }
  revalidatePath("/call-tree");
  return { id };
}

// Saves the draft only if nobody else saved since `rev`. Drafts may have
// warnings and errors; they're checked when the flow is published.
export async function saveFlowDraft(id: string, draft: unknown, rev: number): Promise<{ rev?: number; conflict?: boolean; error?: string }> {
  await requireUser();
  const parsed = flowSchema.safeParse(draft);
  if (!parsed.success) return { error: "That flow isn't in the right format." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("call_flows")
    .update({ draft: parsed.data, name: parsed.data.name }).eq("id", id).eq("draft_rev", rev).select("draft_rev").maybeSingle();
  if (error) return { error: "Couldn't save the flow." };
  if (!data) {
    const { data: still } = await supabase.from("call_flows").select("id").eq("id", id).maybeSingle();
    return still ? { conflict: true } : { error: "This flow was deleted, or you no longer have access." };
  }
  return { rev: data.draft_rev };
}

export async function deleteFlow(id: string): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("call_flows").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Only the flow's owner can delete it." };
  revalidatePath("/call-tree");
  return { ok: "Deleted." };
}
