"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { voiceToken } from "@/lib/comms/twilio";
import { toE164 } from "@/lib/notify/senders";
import { memberIdentity } from "@/lib/redial/live";
import { createClient } from "@/lib/supabase/server";
import { sampleFlow, starterFlow } from "./blocks";
import { flowRuns } from "./data";
import { makeTestTicket } from "./test-call";
import { canPublish, flowSchema, validateFlow } from "./schema";

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

// Publish the saved draft as the next version, and set which lines answer
// with it. A line runs one call tree, so choosing a line here takes it from
// any other tree.
export async function publishFlow(id: string, note: string, lineIds: string[]): Promise<{ version?: number; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data: f } = await supabase.from("call_flows").select("draft").eq("id", id).maybeSingle();
  if (!f) return { error: "This call tree was deleted, or you no longer have access." };
  const { issues } = validateFlow(f.draft);
  if (!canPublish(issues)) return { error: "Fix the problems marked in red first." };
  const { data: version, error } = await supabase.rpc("call_flow_publish", { p_flow: id, p_note: note.trim().slice(0, 300) || null });
  if (error) return { error: "Couldn't publish the call tree." };
  const lines = await setFlowLines(supabase, id, lineIds);
  revalidatePath(`/call-tree/${id}`);
  revalidatePath("/call-tree");
  return lines.error ? { version: version as number, error: lines.error } : { version: version as number };
}

async function setFlowLines(supabase: Awaited<ReturnType<typeof createClient>>, id: string, lineIds: string[]): Promise<{ error?: string }> {
  const wanted = [...new Set(lineIds.filter((l) => /^[0-9a-f-]{36}$/i.test(l)))].slice(0, 50);
  const { data: current } = await supabase.from("call_flow_lines").select("line_id").eq("flow_id", id);
  const drop = (current ?? []).map((r) => r.line_id).filter((l) => !wanted.includes(l));
  if (drop.length) await supabase.from("call_flow_lines").delete().eq("flow_id", id).in("line_id", drop);
  for (const lineId of wanted) {
    if ((current ?? []).some((r) => r.line_id === lineId)) continue;
    await supabase.from("call_flow_lines").delete().eq("line_id", lineId);
    const { error } = await supabase.from("call_flow_lines").insert({ line_id: lineId, flow_id: id });
    if (error) return { error: "Published, but some lines couldn't be switched to this call tree." };
  }
  return {};
}

export async function rollbackFlow(id: string, version: number): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("call_flow_rollback", { p_flow: id, p_version: version });
  if (error) return { error: "Couldn't roll back." };
  revalidatePath(`/call-tree/${id}`);
  return { ok: `Version ${version} is live again, and the draft matches it.` };
}

// Stop answering a line with this call tree (the line goes back to its usual screening).
export async function detachFlowLine(id: string, lineId: string): Promise<{ ok?: string; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("call_flow_lines").delete().eq("flow_id", id).eq("line_id", lineId);
  if (error) return { error: "Couldn't change that line." };
  revalidatePath(`/call-tree/${id}`);
  return { ok: "That line answers with its usual screening again." };
}

// For the Calls panel in the builder (RLS: people who can edit the call tree
// or read the line's calls).
export async function loadFlowRuns(id: string) {
  await requireUser();
  return flowRuns(id);
}

// A browser test call of the draft: a voice token that can only place calls,
// and a ticket naming this call tree (checked by the voice webhook).
export async function startTestCall(id: string): Promise<{ token?: string; ticket?: string; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("call_flows").select("id").eq("id", id).maybeSingle();
  if (!data) return { error: "This call tree was deleted, or you no longer have access." };
  const [token, ticket] = await Promise.all([voiceToken(memberIdentity(user.id), { incoming: false }), makeTestTicket(id)]);
  if (!token || !ticket) return { error: "Test calls need the browser phone set up (Twilio API key and TwiML App in Admin → Settings → Integrations)." };
  return { token, ticket };
}
