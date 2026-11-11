"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { sampleFlow, starterFlow } from "./blocks";
import { flowSchema } from "./schema";

// Call Tree edits, as the signed-in person (RLS decides who can edit).

export async function createFlow(name: string, from: "blank" | "sample" = "blank"): Promise<{ id?: string; error?: string }> {
  await requireUser();
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: "Give the call tree a name." };
  const supabase = await createClient();
  // The id is made here: reading the new row back would go through the select
  // policy's helper, which can't see a row inserted in the same statement.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("call_flows").insert({ id, name: clean, draft: from === "sample" ? sampleFlow(clean) : starterFlow(clean) });
  if (error) {
    console.error("[flows] create", error.message);
    return { error: "Couldn't create the call tree." };
  }
  revalidatePath("/call-tree");
  return { id };
}

// Saves the draft only if nobody else saved since `rev`. Drafts may have
// warnings and errors; they're checked when the flow is published.
export async function saveFlowDraft(id: string, draft: unknown, rev: number): Promise<{ rev?: number; conflict?: boolean; error?: string }> {
  await requireUser();
  const parsed = flowSchema.safeParse(draft);
  if (!parsed.success) return { error: "That call tree isn't in the right format." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("call_flows")
    .update({ draft: parsed.data, name: parsed.data.name }).eq("id", id).eq("draft_rev", rev).select("draft_rev").maybeSingle();
  if (error) return { error: "Couldn't save the call tree." };
  if (!data) {
    const { data: still } = await supabase.from("call_flows").select("id").eq("id", id).maybeSingle();
    return still ? { conflict: true } : { error: "This call tree was deleted, or you no longer have access." };
  }
  return { rev: data.draft_rev };
}

export async function deleteFlow(id: string): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("call_flows").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Only the call tree's owner can delete it." };
  revalidatePath("/call-tree");
  return { ok: "Deleted." };
}

// Extensions on a line (101 → Sales). RLS: manage_flows on the line.
export type ExtensionInput = {
  id?: string; lineId: string; ext: string; name: string; directoryId: string | null; number: string;
  ringSeconds: number; voicemailAudioId: string | null;
};

export async function saveExtension(e: ExtensionInput): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  if (!/^[0-9]{2,6}$/.test(e.ext)) return { error: "Extensions are 2 to 6 digits, like 101." };
  if (!e.name.trim()) return { error: "Name the extension, like Sales." };
  const number = e.number.trim() ? toE164(e.number) : null;
  if (e.number.trim() && !number) return { error: "Enter the number to ring, like (480) 555-0142." };
  if (!e.directoryId && !number) return { error: "Choose a Directory contact or enter a number to ring." };
  const row = {
    ext: e.ext, name: e.name.trim().slice(0, 80), directory_id: e.directoryId, number: e.directoryId ? null : number,
    ring_seconds: Math.max(5, Math.min(60, Math.round(e.ringSeconds) || 20)), voicemail_audio_id: e.voicemailAudioId,
  };
  const supabase = await createClient();
  const { error } = e.id
    ? await supabase.from("redial_extensions").update(row).eq("id", e.id)
    : await supabase.from("redial_extensions").insert({ ...row, line_id: e.lineId });
  if (error) return { error: error.code === "23505" ? `Extension ${e.ext} is already used on this line.` : "Couldn't save the extension." };
  return { ok: e.id ? "Extension saved." : `Extension ${e.ext} added.` };
}

export async function deleteExtension(id: string): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("redial_extensions").delete().eq("id", id).select("id");
  return error || !data?.length ? { error: "Couldn't delete that extension." } : { ok: "Extension deleted." };
}
